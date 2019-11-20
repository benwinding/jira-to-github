import { migrateToGithub } from './migrator';
//xml file from jira export (should be entities.xml)
const xmlPath = './entities.xml';
//required
const gitHubData = {
  user: 'benwinding',
  owner: 'resvu',
  repo: 'communitilink-admin',
  token: '0ddf74a2d3b3f96ba5d82ae0ad9e8e973c361898'
};
//required
const project = '10008';
//change to true to send data to github api
const prod = process.env.ENVIRONMENT === 'production';
//optional
const userNameMapping = {
  'hello': 'benwinding',
  'admin': 'Joshua-Marcus',
  'johannmunoz.dev': 'johannmunoz',
};

migrateToGithub(xmlPath, gitHubData, project, prod, userNameMapping);
