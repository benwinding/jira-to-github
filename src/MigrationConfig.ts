export interface MigrationConfig {
  xmlPath: string;
  github: {
    user: string;
    repo_path: string;
    token: string;
  };
  jiraProjectId: string;
  prod: boolean;
  userMap: {
    [key: string]: string;
  };
}
