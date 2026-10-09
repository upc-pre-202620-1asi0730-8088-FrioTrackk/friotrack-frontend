import { DeviceCodeCredential } from '@azure/identity';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const tenantId='0e0cb060-09ad-49f5-a005-68b9b49aa1f6';
const subscriptionId='bce6db1b-2de4-491e-aa92-4f9c47db032d';
const resourceGroup='rg-friotrack-tb1';
const appName='friotrack-api-bce6db1b';
const root=`/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web`;
const version='2024-11-01';
const credential=new DeviceCodeCredential({tenantId,userPromptCallback:i=>console.log(i.message)});
const access=await credential.getToken('https://management.azure.com/.default');
const headers={Authorization:`Bearer ${access.token}`,'Content-Type':'application/json'};
async function arm(path, method='GET', body) {
 const response=await fetch('https://management.azure.com'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(`${response.status}: ${JSON.stringify(result)}`);
 return result;
}
const providerPath=`/subscriptions/${subscriptionId}/providers/Microsoft.Web`;
let provider=await arm(providerPath+'?api-version=2021-04-01');
if(provider.registrationState!=='Registered') {
 await arm(providerPath+'/register?api-version=2021-04-01','POST');
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,5000));provider=await arm(providerPath+'?api-version=2021-04-01');if(provider.registrationState==='Registered')break;}
}
await mkdir('.azure-tools', { recursive: true });
let accounts;
try{accounts=JSON.parse(await readFile('.azure-tools/accounts.json','utf8'));}
catch{accounts={coordinator:{email:'coordinador@friotrack.app',password:'FtC!'+randomBytes(10).toString('base64url')},client:{email:'cliente@friotrack.app',password:'FtL!'+randomBytes(10).toString('base64url')}};await writeFile('.azure-tools/accounts.json',JSON.stringify(accounts,null,2));}
let plan;
try{plan=await arm(root+'/serverfarms/plan-friotrack-free?api-version='+version);}
catch(error){if(!error.message.startsWith('404:'))throw error;}
if(!plan){
 for(const location of ['westus','canadacentral','northcentralus']){
  try{plan=await arm(root+'/serverfarms/plan-friotrack-free?api-version='+version,'PUT',{location,kind:'app',sku:{name:'F1',tier:'Free',capacity:1},properties:{reserved:false}});break;}
  catch(e){console.log('Free plan creation in '+location+': '+e.message);if(!/quota|capacity|unavailable/i.test(e.message))throw e;}
 }
 if(!plan)throw new Error('No free App Service capacity is available in permitted regions.');
}
console.log('App Service plan: '+plan.location+' · Free F1');
let app=await arm(root+'/sites/'+appName+'?api-version='+version,'PUT',{
 location:plan.location,kind:'app',properties:{serverFarmId:plan.id,httpsOnly:true,siteConfig:{netFrameworkVersion:'v10.0',use32BitWorkerProcess:true,alwaysOn:false,minTlsVersion:'1.2',ftpsState:'Disabled',appSettings:[
 {name:'FRIOTRACK_COORDINATOR_PASSWORD',value:accounts.coordinator.password},
 {name:'FRIOTRACK_CLIENT_PASSWORD',value:accounts.client.password},
 {name:'FRIOTRACK_ORIGINS',value:'https://friotracktb1bce6db1b.z22.web.core.windows.net,http://localhost:5173,http://127.0.0.1:5173'},
 {name:'WEBSITE_RUN_FROM_PACKAGE',value:'1'},
 {name:'SCM_DO_BUILD_DURING_DEPLOYMENT',value:'false'},
 {name:'WEBSITE_ENABLE_SYNC_UPDATE_SITE',value:'true'},
 ]}}});
for(let i=0;i<60;i++) {
 app=await arm(root+'/sites/'+appName+'?api-version='+version);
 if(app.properties.state==='Running' && app.properties.enabledHostNames?.some(h=>h.includes('.scm.')))break;
 await new Promise(r=>setTimeout(r,5000));
}
console.log('API infrastructure ready. Uploading package with Microsoft Entra authentication.');
const scm=app.properties.enabledHostNames.find(h=>h.includes('.scm.'));
const packageBytes=await readFile('output/friotrack-api.zip');
const deploy=await fetch(`https://${scm}/api/zipdeploy?isAsync=true`,{method:'POST',headers:{Authorization:headers.Authorization,'Content-Type':'application/zip'},body:packageBytes});
if(!deploy.ok)throw new Error('Deployment '+deploy.status+': '+await deploy.text());
const location=deploy.headers.get('location');
for(let i=0;i<90;i++){
 await new Promise(r=>setTimeout(r,5000));
 const response=await fetch(location||`https://${scm}/api/deployments/latest`,{headers:{Authorization:headers.Authorization}});
 const status=await response.json();
 if(status.status===4){console.log('API package deployed.');break;}
 if(status.status===3)throw new Error('Kudu deployment failed: '+JSON.stringify(status));
 if(i===89)throw new Error('Deployment did not finish within the polling window.');
}
const apiUrl='https://'+app.properties.defaultHostName+'/api';
for(let i=0;i<30;i++){
 const response=await fetch(apiUrl+'/health').catch(()=>null);
 if(response?.ok){console.log('API healthy: '+apiUrl);break;}
 if(i===29)throw new Error('API health check failed.');
 await new Promise(r=>setTimeout(r,5000));
}
await writeFile('docs/azure-api-deployment.json',JSON.stringify({apiUrl,appName,resourceGroup,plan:'plan-friotrack-free',tier:'Free F1',location:plan.location,runtime:'.NET 10',deployedAt:new Date().toISOString()},null,2));
