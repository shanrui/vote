const exec = require('child_process').exec;

function exec_cmd(cmd){
  console.log(cmd);
  return new Promise((resolve, reject)=>{
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject();
      }
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      return resolve(stdout);
    });
  });
}

for(let i=1; i<=3;i++){
    exec_cmd(`node ${__dirname}/../app.js ${__dirname}/node${i}_conf.json`);
}