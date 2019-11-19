var migrate = require('./jiraToGitHub').migrate;
//xml file from jira export (should be entities.xml)
var xmlPath = './entities.xml';
//required
var gitHubData = {
  user: 'benwinding',
  owner: 'resvu',
  repo: 'communitilink-admin',
  token: '0ddf74a2d3b3f96ba5d82ae0ad9e8e973c361898'
};
//required
var project = '10008';
//change to true to send data to github api
prod = process.env.ENVIRONMENT === 'production';
//optional
var userNameMapping = {
  'hello': 'benwinding',
  'admin': 'Joshua-Marcus',
  'johannmunoz.dev': 'johannmunoz',
};

migrate(xmlPath, gitHubData, project, prod, userNameMapping);