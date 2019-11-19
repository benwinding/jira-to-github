// libs

const Parser = require("node-xml-stream");
const fs = require("fs");
const request = require("request");

/**
 *
 * @param {string} xmlPath relative path to the xml
 * @param {Object} github { user: 'testuser', repo: 'testrepo', token: 'abc'}
 * @param {string} project the code of the project
 * @param {boolean} prod if true send data to github api
 * @param {Object} users {'jiraUserName': 'GitHubUserName','jiraUserName2': 'GitHubUserName2'}
 */
function migrate(xmlPath, github, project, prod, users) {
  if (!users) users = {};

  function author2Name(author) {
    return users[author] || author;
  }
  var parser = new Parser();
  //Array for all Issues in xml file
  var parsedIssues = [];
  var parsedComments = [];
  var parsedVersions = [];
  var parsedFixVersions = [];

  var lastTagName = "";
  var lastTagType = "";

  parser.on("opentag", (name, attrs) => {
    const allowedTags = ["Issue", "Action", "Version", "FixVersion"];
    if (!allowedTags.includes(name)) {
      return;
    }
    lastTagName = name;
    lastTagType = attrs.type;
    if (lastTagName === "Issue") {
      parsedIssues.push(attrs);
    }
    if (lastTagName === "Action" && lastTagType === "comment") {
      parsedComments.push(attrs);
    }
    if (lastTagName === "Version") {
      parsedVersions.push(attrs);
    }
    if (lastTagName === "FixVersion") {
      parsedFixVersions.push(attrs);
    }
  });

  parser.on("cdata", cdata => {
    const isComment = lastTagName === "Action" && lastTagType === "comment";
    if (isComment) {
      const lastComment = parsedComments[parsedComments.length - 1];
      if (lastComment && !lastComment.body) {
        lastComment.body = cdata;
      }
    }
    const isIssue = lastTagName === "Issue";
    if (isIssue) {
      const lastIssue = parsedComments[parsedComments.length - 1];
      if (lastIssue && !lastIssue.summary) {
        lastIssue.summary = cdata;
      }
    }
  });

  parser.on("finish", () => {
    //Array for all Issues which will be actually send to github api
    const projectIssues = parsedIssues.filter(elem => elem.project == project);
    const projectIssueIds = new Set(projectIssues.map(i => i.id));

    const versionNameMap = parsedVersions.reduce((acc, cur) => {
      acc[cur.id] = cur.name;
      return acc;
    }, {});
    const projectComments = parsedComments.filter(elem =>
      projectIssueIds.has(elem.issue)
    );

    const issueVersionMap = parsedFixVersions.reduce((acc, cur) => {
      const versionId = cur.version.replace(/\D/g, "");
      const issueId = cur.issue + "";
      acc[issueId] = versionNameMap[versionId];
      return acc;
    }, {});

    function getLabels(elem) {
      const jiraIssueId = elem.id;
      const labels = [];
      const matchingVersion = issueVersionMap[jiraIssueId];
      if (!!matchingVersion) {
        labels.push('v' + matchingVersion);
      }
      const isHighPriority = elem.priority == "1";
      if (isHighPriority) {
        labels.push("urgent");
      }
      if (elem.status == "10001") {
        labels.push("done");
      }
      return labels;
    }

    async function sendJiraIssueCommentsToGithub(jiraIssueId, githubIssueId) {
      const matchingComments = projectComments.filter(
        c => c.issue === jiraIssueId
      );
      if (!matchingComments.length) {
        return;
      }
      matchingComments.sort((a, b) => {
        const va = a.created;
        const vb = b.created;
        if (va < vb) {
          return 1;
        }
        if (va > vb) {
          return -1;
        }
        return 0;
      });
      const translatedComments = matchingComments.map(jiraComment => {
        return {
          body: `[author: ${author2Name(jiraComment.author)}] ${
            jiraComment.body
          }`
        };
      });
      async function sendCommentToGithub(comment) {
        const options = {
          uri: `https://api.github.com/repos/${github.owner}/${github.repo}/issues/${githubIssueId}/comments?access_token=${github.token}`,
          headers: {
            "User-Agent": github.user
          },
          json: comment,
          method: "POST"
        };
        return requestPromise(options, prod);
      }
      for (const comment of translatedComments) {
        await sendCommentToGithub(comment);
      }
    }

    function translateToGithubIssue(elem) {
      var issue = {
        title: "",
        body: "",
        assignees: [],
        labels: []
      };
      const isSubtask = !!elem.subtaskParentId;
      if (isSubtask) {
        const parent = projectIssues
          .filter(i => i.id === elem.subtaskParentId)
          .pop();
        issue.labels = getLabels(parent);
        issue.title = `${parent.summary} - ${elem.summary}`;
        if (elem.description) {
          issue.body = `[subtask] ${elem.description}`;
        }
      } else {
        issue.title = elem.summary;
        if (elem.description) {
          issue.body = elem.description;
        }
        issue.labels = getLabels(elem);
      }
      if (users.hasOwnProperty(elem.assignee)) {
        issue.assignees.push(author2Name(elem.assignee));
      }
      if (issue.assignees.length === 0) {
        delete issue.assignees;
      }
      if (issue.body == undefined) {
        delete issue.body;
      }
      return issue;
    }
    console.log('found ', projectIssues.length, ' issues in the project: ', project)
    projectIssues.forEach(async function(elem, index) {
      const jiraIssueId = elem.id;
      //options for github api request
      var requestOptions = {
        uri: `https://api.github.com/repos/${github.owner}/${github.repo}/issues?access_token=${github.token}`,
        headers: {
          "User-Agent": github.user
        },
        json: translateToGithubIssue(elem),
        method: "POST"
      };
      try {
        const response = await requestPromise(requestOptions, prod);
        if (!response) {
          return;
        }
        const ghIssueNum = response.body.number;
        sendJiraIssueCommentsToGithub(jiraIssueId, ghIssueNum);
      } catch (error) {
        console.log(error);
      }
    });
  });

  // Pipe a stream to the parser
  let stream = fs.createReadStream(xmlPath);
  stream.pipe(parser);
}

let concurrentCount = 0;
const maxCount = 2;
const retries = 100;

async function requestPromise(options, isProd) {
  for (let i = 0; i < retries; i++) {
    if (concurrentCount < maxCount) {
      break;
    }
    await new Promise(resolve => setTimeout(() => resolve(), 1600));
  }
  if (!isProd) {
    console.log(
      "Data which would be send to github api",
      JSON.stringify(options)
    );
    return;
  }
  console.log("Sending to api", JSON.stringify({ options }));
  return new Promise((resolve, reject) => {
    concurrentCount++;
    request(options, function(error, response, body) {
      concurrentCount--;
      if (error) {
        console.log(error);
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

module.exports = {
  migrate
};
