// libs

const Parser = require('node-xml-stream');
const fs = require('fs');
const request = require('request');

/**
 * 
 * @param {string} xmlPath relative path to the xml
 * @param {Object} github { user: 'testuser', repo: 'testrepo', token: 'abc'}
 * @param {string} project the code of the project
 * @param {boolean} prod if true send data to github api
 * @param {Array} status Array of status codes which should be excluded - 10001 = DONE
 * @param {Object} users {'jiraUserName': 'GitHubUserName','jiraUserName2': 'GitHubUserName2'}
 */
function migrate(xmlPath, github, project, prod, status, users) {

  //status 10001 = DONE -> default: excludes all DONE issues
  if (!status) status = [];
  if (!users) users = {};
  //options for github api request
  var requestOptions = {
    uri: 'https://api.github.com/repos/' + github.user + '/' + github.repo + '/issues?access_token=' + github.token,
    headers: {
      'User-Agent': github.user
    },
    json: '',
    method: 'POST'
  };
  var parser = new Parser();
  //Array for all Issues in xml file
  var resultArr = [];

  parser.on('opentag', (name, attrs) => {
    if (name === 'Issue') {
      resultArr.push(attrs);
    }
  });

  parser.on('cdata', cdata => {
    if (resultArr[resultArr.length - 1] && !resultArr[resultArr.length - 1].description) resultArr[resultArr.length - 1].description = cdata;
  });

  parser.on('finish', () => {
    //Array for all Issues which will be actually send to github api
    var final = [];
    resultArr.forEach(function (elem) {
      if (status.every(stat => stat != elem.status) && elem.project == project) {
        final.push(elem);
      }
    });

    final.forEach(function (elem, index) {
      var issue = {
        'title': '',
        'body': '',
        'assignees': [],
      };
      issue.title = elem.summary;
      issue.body = elem.description;
      if (users.hasOwnProperty(elem.assignee)) {
        issue.assignees.push(users[elem.assignee]);
      }
      if (issue.assignees.length === 0) {
        delete issue.assignees;
      }
      if (issue.body == undefined) {
        delete issue.body;
      }

      requestOptions.json = issue;
      if (prod) {
        request(requestOptions,
          function (error, response, body) {
            if (error) {
              console.log(error);
            }
          });
      } else {
        console.log("Data which would be send to github api");
        console.log(requestOptions);
      }

    });
  });

  // Pipe a stream to the parser
  let stream = fs.createReadStream(xmlPath);
  stream.pipe(parser);

}

module.exports = {
  migrate
};