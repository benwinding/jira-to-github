export interface MigrationConfig {
  xmlPath: string;
  github: {
    user: string;
    owner: string;
    repo: string;
    token: string;
  };
  jiraProjectId: string;
  prod: boolean;
  userMap: {
    [key: string]: string;
  };
}
