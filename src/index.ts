import { GithubMigrator } from './migrator';
import { MigrationConfig } from './MigrationConfig';

const config: MigrationConfig = {
  //xml file from jira export (should be entities.xml)
  xmlPath: './entities.xml',
  //github details
  github: {
    // Your github username
    user: 'benwinding',
    // example/repo
    repo_path: 'resvu/communitilink-admin',
    // Your github token
    token: '0ddf74a2d3b3f96ba5d82ae0ad9e8e973c361898'
  },
  // Project id from Jira
  jiraProjectId: '10008',
  // Will not add data unless in "production mode"
  prod: process.env.ENVIRONMENT === 'production',
  // Map user names from Jira to Github, if not found it will use Jira name.
  userMap: {
    'hello': 'benwinding',
    'admin': 'Joshua-Marcus',
    'johannmunoz.dev': 'johannmunoz',
  }
}

const migrator = new GithubMigrator(config);

migrator.Convert();
