import request, { Options, Response } from 'request';

let concurrentCount = 0;
const maxCount = 1;
const retries = 200;
export async function requestPromise(options: Options, isProd: boolean): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    if (concurrentCount < maxCount) {
      break;
    }
    await new Promise(resolve => setTimeout(() => resolve(), 1500));
  }
  concurrentCount++;
  if (!isProd) {
    console.log(
      "Data which would be send to github api",
      JSON.stringify(options)
    );
    await new Promise(resolve => setTimeout(() => resolve(), 100));
    concurrentCount--;
    return;
  }
  return new Promise((resolve, reject) => {
    request(options, function(error, response, body) {
      concurrentCount--;
      if (error) {
        console.log(error);
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

