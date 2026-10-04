import type { ReactiveController, ReactiveControllerHost } from "lit";
type Issue = {readonly field:string;readonly message:string};
type Control = HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const control = (node:unknown):node is Control => node instanceof HTMLInputElement||node instanceof HTMLSelectElement||node instanceof HTMLTextAreaElement;
let nextErrorId=0;
/** Owns native form error associations inside its host; parents pass data, never reach into shadow roots. */
export class FormErrors implements ReactiveController {
 private form:HTMLFormElement|undefined;
 private corrected=new Set<Control>();
 private lastIssues:ReadonlyArray<Issue>=[];
 private entries:ReadonlyArray<{control:Control;message:HTMLSpanElement;previous:string|null}>=[];
 constructor(private readonly host:ReactiveControllerHost&HTMLElement,private readonly issues:()=>ReadonlyArray<Issue>){host.addController(this);}
 private readonly input=(event:Event)=>{const field=event.composedPath().find(control);if(field){this.corrected.add(field);const removed=this.entries.filter((entry)=>entry.control===field);for(const entry of removed){entry.message.remove();if(entry.previous===null)field.removeAttribute("aria-describedby");else field.setAttribute("aria-describedby",entry.previous);}this.entries=this.entries.filter((entry)=>entry.control!==field);field.setCustomValidity("");field.removeAttribute("aria-invalid");}};
 hostConnected(){this.host.addEventListener("input",this.input);}
 hostDisconnected(){this.host.removeEventListener("input",this.input);this.clear();}
 remember(event:SubmitEvent){this.clear();this.corrected.clear();if(event.currentTarget instanceof HTMLFormElement)this.form=event.currentTarget;}
 clear(){for(const entry of this.entries){entry.control.setCustomValidity("");entry.control.removeAttribute("aria-invalid");if(entry.previous===null)entry.control.removeAttribute("aria-describedby");else entry.control.setAttribute("aria-describedby",entry.previous);entry.message.remove();}this.entries=[];}
 hostUpdated(){const issues=this.issues();if(issues!==this.lastIssues){this.corrected.clear();this.lastIssues=issues;}this.clear();const form=this.form;if(!form||!form.isConnected)return;
  const aliases:Readonly<Record<string,ReadonlyArray<string>>>={dates:["start_date","end_date"],date:["date","start_date","end_date"],time:["start","end"],email:["email","primary"]};
  for(const issue of issues)for(const name of aliases[issue.field]??[issue.field]){
   const field=form.elements.namedItem(name);if(!control(field)||this.corrected.has(field))continue;
   const message=document.createElement("span");message.id=`field-error-${++nextErrorId}`;message.className="field-error";message.textContent=issue.message;field.insertAdjacentElement("afterend",message);
   const previous=field.getAttribute("aria-describedby");field.setAttribute("aria-describedby",`${previous??""} ${message.id}`.trim());field.setAttribute("aria-invalid","true");field.setCustomValidity(issue.message);this.entries=[...this.entries,{control:field,message,previous}];
  }
 }
}
