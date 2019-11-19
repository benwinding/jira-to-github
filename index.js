var migrate = require('./jiraToGitHub').migrate;
//xml file from jira export (should be entities.xml)
var xmlPath = './entities.xml';
//required
var gitHubData = {
  user: 'benwinding',
  owner: 'resvu',
  repo: 'fmlink-admin-migrated',
  token: 'a91088eb14182b53054422c293c219ac03856c39'
};
//required
var project = '10010';
//change to true to send data to github api
prod = process.env.ENVIRONMENT === 'production';
//optional
var userNameMapping = {
  'hello': 'benwinding',
  'admin': 'Joshua-Marcus',
  'johannmunoz.dev': 'johannmunoz',
};

migrate(xmlPath, gitHubData, project, prod, userNameMapping);