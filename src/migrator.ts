const Parser = require("node-xml-stream");
const fs = require("fs");
import { requestPromise } from "./request";
import { MigrationConfig } from "./MigrationConfig";

export class GithubMigrator {
  constructor(private config: MigrationConfig) {
    if (!this.config.userMap) {
      this.config.userMap = {};
    }
  }

  public async Convert() {
    const parsed = await GetFromXml(
      this.config.xmlPath,
      this.config.jiraProjectId
    );
    const translated = await TranslateParsed(parsed, this.config);
    UploadTranslated(translated, this.config);
  }
}

async function UploadIssue(
  issueComments: GithubIssueComments,
  c: MigrationConfig
) {
  const requestIssueOptions = {
    uri: `https://api.github.com/repos/${c.github.repo_path}/issues?access_token=${c.github.token}`,
    headers: {
      "User-Agent": c.github.user
    },
    json: issueComments.issue,
    method: "POST"
  };
  const response = await requestPromise(requestIssueOptions, c.prod);
  const githubIssueId = response.body.number;
  if (issueComments.issue.state === 'closed') {
    UploadToClosed(githubIssueId, c);
  }
  if (!githubIssueId) {
    console.error(
      '--- failed to retrieve github issue "number", possibly rate limited, adding to "try again" file'
    );
    return;
  }
  await UploadComments(issueComments.comments, githubIssueId, c);
}

async function UploadToClosed(githubIssueId: string, c: MigrationConfig) {
  const requestIssueOptions = {
    uri: `https://api.github.com/repos/${c.github.repo_path}/issues/${githubIssueId}?access_token=${c.github.token}`,
    headers: {
      "User-Agent": c.github.user
    },
    json: {
      state: 'closed'
    },
    method: "PATCH"
  };
  const response = await requestPromise(requestIssueOptions, c.prod);
  const returnedIssueId = response.body.number;
  if (!returnedIssueId) {
    console.error(
      '--- failed to retrieve github issue "number" when patching state, possibly rate limited, adding to "try again" file'
    );
    return;
  }
}

async function UploadComments(
  comments: GithubComment[],
  githubIssueId: number,
  c: MigrationConfig
) {
  return await Promise.all(
    comments.map(async comment => {
      const options = {
        uri: `https://api.github.com/repos/${c.github.repo_path}/issues/${githubIssueId}/comments?access_token=${c.github.token}`,
        headers: {
          "User-Agent": c.github.user
        },
        json: comment,
        method: "POST"
      };
      const response = await requestPromise(options, c.prod);
      if (!response.body.id) {
        console.error(
          '--- failed to retrieve github comment "id", possibly rate limited, adding to "try again" file'
        );
        return;
      }
    })
  );
}

function UploadTranslated(translated: GithubIssueMap, c: MigrationConfig) {
  Object.keys(translated).map(issueId => {
    try {
      const issueComments = translated[issueId];
      UploadIssue(issueComments, c);
    } catch (error) {}
    translated[issueId].issue;
  });
}

interface GithubComment {
  body: string;
}

interface GithubIssue {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  state?: "open" | "closed";
}

interface GithubIssueComments {
  issue: GithubIssue;
  comments: GithubComment[];
}

interface GithubIssueMap {
  [jiraIssueId: string]: GithubIssueComments;
}

function getLabels(
  jissue: JiraIssue,
  issueVersionMap: { [jiraId: string]: string }
) {
  const jiraIssueId = jissue.id;
  const labels = [];
  const matchingVersion = issueVersionMap[jiraIssueId];
  if (!!matchingVersion) {
    labels.push("v" + matchingVersion);
  }
  const isHighPriority = jissue.priority == "1";
  if (isHighPriority) {
    labels.push("urgent");
  }
  return labels;
}

async function TranslateParsed(
  parsed: ParsedItems,
  c: MigrationConfig
): Promise<GithubIssueMap> {
  //Array for all Issues which will be actually send to github api
  const versionNameMap = parsed.Versions.reduce((acc, cur) => {
    acc[cur.id] = cur.name;
    return acc;
  }, {});

  const issueVersionMap = parsed.FixVersions.reduce((acc, cur) => {
    const versionId = cur.version.replace(/\D/g, "");
    const issueId = cur.issue + "";
    acc[issueId] = versionNameMap[versionId];
    return acc;
  }, {});

  function author2Name(author: string) {
    return c.userMap[author] || author;
  }

  let ghIssueMap: GithubIssueMap;
  ghIssueMap = parsed.Issues.reduce((acc, issue) => {
    const issueOpen = issue.status === "10001";
    const ghIssue: GithubIssue = {
      title: issue.summary,
      assignees: [issue.assignee],
      state: issueOpen ? "open" : "closed"
    };
    const isSubtask = !!issue.subtaskParentId;
    if (isSubtask) {
      const parent = parsed.Issues.filter(
        i => i.id === issue.subtaskParentId
      ).pop();
      ghIssue.labels = getLabels(parent, issueVersionMap);
      ghIssue.title = `${parent.summary} - ${ghIssue.title}`;
      if (issue.description) {
        ghIssue.body = `[subtask] ${issue.description}`;
      }
    } else {
      ghIssue.labels = getLabels(issue, issueVersionMap);
      ghIssue.body = issue.description;
    }
    ghIssue.body = `[submitted by ${author2Name(issue.reporter)}] ${
      ghIssue.body
    }`;
    acc[issue.id] = {
      issue: ghIssue,
      comments: []
    };
    return acc;
  }, {} as GithubIssueMap);

  parsed.Comments.map(comment => {
    if (!ghIssueMap[comment.issue]) {
      return;
    }
    const ghComment: GithubComment = {
      body: comment.body
    };
    ghIssueMap[comment.issue].comments.push(ghComment);
  });

  return ghIssueMap;
}

class ParsedItems {
  Issues: JiraIssue[] = [];
  Comments: JiraComment[] = [];
  Versions: JiraVersion[] = [];
  FixVersions: JiraFixVersion[] = [];
}

interface JiraIssue {
  id: string; // ="10362"
  projectKey: string; // ="COMADMIN"
  number: string; // ="64"
  project: string; // ="10008"
  reporter: string; // ="admin"
  creator: string; // ="admin"
  type: string; // ="10003"
  summary: string; // ="delete Alert functionality "
  description: string; // ="delete Alert functionality "
  assignee: string; // ="delete Alert functionality "
  priority: string; // ="3"
  resolution: string; // ="10000"
  status: string; // ="10001"
  created: string; // ="2019-06-13 02:07:37.985"
  updated: string; // ="2019-06-18 00:25:17.857"
  resolutiondate: string; // ="2019-06-18 00:25:17.854"
  votes: string; // ="0"
  watches: string; // ="1"
  workflowId: string; // ="10362"
  denormalisedSubtaskParent: string; // ="10359"
  subtaskParentId?: string; // ="10359"
  effectiveSubtaskParentId: string; // ="10359"
}

interface JiraComment {
  id: string;
  issue: string;
  author: string;
  type: string;
  body?: string;
  created: string;
  updateauthor: string;
  updated: string;
}

interface JiraVersion {
  id: string;
  project: string;
  name: string;
}

interface JiraFixVersion {
  issue: string;
  version: string;
}

async function GetFromXml(
  xmlPath: string,
  jiraProjectId: string
): Promise<ParsedItems> {
  const parser = new Parser();

  const parsed = new ParsedItems();

  var lastTagName = "";
  var lastTagType = "";

  parser.on("opentag", (name: string, attrs: any) => {
    const allowedTags = ["Issue", "Action", "Version", "FixVersion"];
    if (!allowedTags.includes(name)) {
      return;
    }
    const isPartOfProject = attrs.project && attrs.project === jiraProjectId;
    if (!isPartOfProject) {
      return;
    }
    lastTagName = name;
    lastTagType = attrs.type;
    if (lastTagName === "Issue") {
      parsed.Issues.push(attrs);
    }
    if (lastTagName === "Action" && lastTagType === "comment") {
      parsed.Comments.push(attrs);
    }
    if (lastTagName === "Version") {
      parsed.Versions.push(attrs);
    }
    if (lastTagName === "FixVersion") {
      parsed.FixVersions.push(attrs);
    }
  });

  parser.on("cdata", cdata => {
    const isComment = lastTagName === "Action" && lastTagType === "comment";
    if (isComment) {
      const lastComment = parsed.Comments[parsed.Comments.length - 1];
      if (lastComment && !lastComment.body) {
        lastComment.body = cdata;
      }
    }
    const isIssue = lastTagName === "Issue";
    if (isIssue) {
      const lastIssue = parsed.Issues[parsed.Comments.length - 1];
      if (lastIssue && !lastIssue.description) {
        lastIssue.description = cdata;
      }
    }
  });

  // Pipe a stream to the parser
  let stream = fs.createReadStream(xmlPath);
  stream.pipe(parser);

  await new Promise(resolve => parser.on("finish", () => resolve()));
  parsed.Comments.sort((a, b) => {
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
  return parsed;
}
