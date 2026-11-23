import {runPoolJob} from './simulation-jobs-v33-11-6.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:runPoolJob(data.type,data.args)});}catch(error){self.postMessage({id:data.id,error:error.message});}};
