# Migrate JIRA Issues to GitHub

## Export the issues from JIRA

First, create a full export to XML as described in this guide: https://confluence.atlassian.com/adminjiracloud/exporting-issues-776636787.html

You'll need the exported `entities.xml` from JIRA to upload the issues to your GitHub repository using the GitHub API.

## Run the import to GitHub

Run node index.js to use the script

``` js
var migrate = require('./jiraToGitHub').migrate;
//xml file from jira export (should be entities.xml)
var xmlPath = './test.xml';

//required
var gitHubData = {
  user: 'testuser',
  repo: 'testrepo',
  token: 'abc'
};

//required number of Jira project
var project = '10000';

//change to true to send data to github api
prod = false;

//optional 
var status = ['10001', '10100']; //JIRA Status:  10001 = DONE 10100 = Rejected ...

//optional - map username of Jira and Github
var userNameMapping = {
  'jiraUser': 'githubUser',
  'jiraUser2': 'githubUser2',
};

migrate(xmlPath, gitHubData, project, prod, status, userNameMapping);
```

