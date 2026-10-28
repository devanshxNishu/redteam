// Internal input selection only. No ambient environment, files, stores, provider or execution authority.
import {parseContextAnalystConfiguration} from "./context-analyst-config.ts";
import {ContextDataError,freeze} from "./context-data.ts";
const selectedKeys=new WeakMap<object,string>();
export function selectContextStartInput(suppliedArguments:unknown,suppliedConfiguration:unknown,readSelectedValue:unknown){try{
 if(!Array.isArray(suppliedArguments)||Object.getPrototypeOf(suppliedArguments)!==Array.prototype||suppliedArguments.length!==3||Reflect.ownKeys(suppliedArguments).length!==4)throw new ContextDataError();
 const a:string[]=[];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(suppliedArguments,String(i));if(!d?.enumerable||!("value"in d)||typeof d.value!=="string")throw new ContextDataError();a.push(d.value);}
 const [configurationFile,flag,keyEnvironmentName]=a as[string,string,string];
 if(!configurationFile||configurationFile.length>4096||configurationFile.startsWith("-")||/[\x00-\x1f\x7f]/u.test(configurationFile)||flag!=="--key-env"||!/^[A-Z][A-Z0-9_]{0,63}$/u.test(keyEnvironmentName)||typeof readSelectedValue!=="function")throw new ContextDataError();
 const configuration=parseContextAnalystConfiguration(suppliedConfiguration),key:unknown=readSelectedValue(keyEnvironmentName);
 if(key instanceof Promise){void Promise.prototype.then.call(key,()=>undefined,()=>undefined);throw new ContextDataError();}
 if(typeof key!=="string"||key.length<8||key.length>2048||/[^\x21-\x7e]/u.test(key))throw new ContextDataError();
 const secret=(v:string)=>v.includes(key)||v.includes(JSON.stringify(key).slice(1,-1));if([JSON.stringify(configuration),configurationFile,keyEnvironmentName].some(secret))throw new ContextDataError();
 const selection=freeze({kind:"context_start_input_selection",configurationFile,keyEnvironmentName,configuration,boundaries:{sourceRights:"not_checked",workspaceOwnership:"not_acquired",executionAuthority:"not_granted",providerCompatibility:"not_checked",keyStorage:"ephemeral_not_serialized"}});
 selectedKeys.set(selection,key);return selection;
 }catch{throw new ContextDataError();}}
/** Internal one-use value extraction only; not a grant, observation, receipt or dispatch permission. */
export function takeSelectedContextKey(selection:unknown){try{if(!selection||typeof selection!=="object")throw new ContextDataError();const key=selectedKeys.get(selection);if(key===undefined)throw new ContextDataError();selectedKeys.delete(selection);return key;}catch{throw new ContextDataError();}}
