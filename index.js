var migrate = require('./jiraToGitHub').migrate;
//xml file from jira export (should be entities.xml)
var xmlPath = './test.xml';
//required
var gitHubData = {
  user: 'testuser',
  repo: 'testrepo',
  token: 'abc'
};
//required
var project = '10000';
//change to true to send data to github api
prod = false;
//optional 
var status = ['10001', '10100']; //JIRA Status:  10001 = DONE 10100 = Rejected
//optional
var userNameMapping = {
  'jiraUser': 'githubUser',
  'jiraUser2': 'githubUser2',
};

migrate(xmlPath, gitHubData, project, prod, status, userNameMapping);