const path=require('node:path');
module.exports={apps:[{name:'optionchain-analyzer',cwd:__dirname,script:path.join(__dirname,'server.mjs'),instances:1,exec_mode:'fork',env:{NODE_ENV:'production',OPTIONCHAIN_WORKSPACE_AUTH:'1',OPTIONCHAIN_PORT:'5005',PORTAL_PORT:'5001'}}]};
