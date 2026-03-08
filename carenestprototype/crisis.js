document.addEventListener("DOMContentLoaded", async () => {

const ACTIVE_CHILD_KEY = "carenest_active_child_id";
const LOCAL_DB_KEY = "carenest_prototype_v1";
const CRISIS_KEY = "carenest_crisis_timeline";

const childSwitcher = document.getElementById("childSwitcher");
const childSummary = document.getElementById("childSummary");
const logoutBtn = document.getElementById("logoutBtn");

const protocolBox = document.getElementById("protocolBox");
const rescueMedBox = document.getElementById("rescueMedBox");
const emsBox = document.getElementById("emsBox");
const oxygenBox = document.getElementById("oxygenBox");
const contactsBox = document.getElementById("contactsBox");

const timelineList = document.getElementById("timelineList");

const btnStartCrisis = document.getElementById("btnStartCrisis");
const btnEndCrisis = document.getElementById("btnEndCrisis");

const btnLogSeizureStart = document.getElementById("btnLogSeizureStart");
const btnLogSeizureEnd = document.getElementById("btnLogSeizureEnd");
const btnLogRescueMed = document.getElementById("btnLogRescueMed");
const btnLogOxygen = document.getElementById("btnLogOxygen");
const btnLogCallEms = document.getElementById("btnLogCallEms");
const btnAddNote = document.getElementById("btnAddNote");
const btnClearTimeline = document.getElementById("btnClearTimeline");

let currentUser = null;
let children = [];
let activeChild = null;
let carePlan = null;

function getSupabaseClient(){
  return window.supabaseClient || null;
}

function getActiveChildId(){
  return localStorage.getItem(ACTIVE_CHILD_KEY);
}

function setActiveChildId(id){
  localStorage.setItem(ACTIVE_CHILD_KEY,id);
}

function getLocalDB(){
  try{
    return JSON.parse(localStorage.getItem(LOCAL_DB_KEY)||"{}");
  }catch{
    return {};
  }
}

function getTimeline(){
  const db = getLocalDB();
  return db.crisisTimeline || [];
}

function saveTimeline(list){
  const db = getLocalDB();
  db.crisisTimeline = list;
  localStorage.setItem(LOCAL_DB_KEY,JSON.stringify(db));
}

function logEvent(label){

  const timeline = getTimeline();

  timeline.unshift({
    label,
    time:new Date().toISOString()
  });

  saveTimeline(timeline);

  renderTimeline();

}

function renderTimeline(){

  const timeline = getTimeline();

  timelineList.innerHTML = "";

  if(!timeline.length){
    timelineList.innerHTML = `<div class="muted">No events yet</div>`;
    return;
  }

  timeline.forEach(event=>{
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div>
        <strong>${event.label}</strong>
        <div class="muted">${new Date(event.time).toLocaleString()}</div>
      </div>
    `;
    timelineList.appendChild(div);
  });

}

async function fetchUser(){

  const supabase = getSupabaseClient();

  if(!supabase?.auth) return null;

  const {data,error} = await supabase.auth.getUser();

  if(error) return null;

  return data?.user || null;

}

async function fetchChildren(userId){

  const supabase = getSupabaseClient();

  if(!supabase) return [];

  const {data,error} = await supabase
  .from("children")
  .select("*")
  .eq("parent_id",userId);

  if(error) return [];

  return data || [];

}

async function fetchCarePlan(childId){

  const supabase = getSupabaseClient();

  if(!supabase) return null;

  const {data,error} = await supabase
  .from("care_plans")
  .select("*")
  .eq("child_id",childId)
  .maybeSingle();

  if(error) return null;

  return data || null;

}

function renderChildSwitcher(){

  childSwitcher.innerHTML="";

  children.forEach(child=>{

    const option=document.createElement("option");
    option.value=child.id;
    option.textContent=child.name;

    if(activeChild && child.id===activeChild.id){
      option.selected=true;
    }

    childSwitcher.appendChild(option);

  });

}

function renderChildSummary(){

  if(!activeChild){
    childSummary.textContent="No child selected";
    return;
  }

  childSummary.textContent = activeChild.name;

}

function renderCarePlan(){

  if(!carePlan){
    protocolBox.textContent="No protocol saved";
    return;
  }

  protocolBox.textContent = carePlan.seizure_protocol || "No protocol";

  rescueMedBox.innerHTML = `
  <div><strong>${carePlan.rescue_med_name || "None"}</strong></div>
  <div>${carePlan.rescue_med_dose || ""}</div>
  <div>${carePlan.rescue_med_route || ""}</div>
  `;

  emsBox.textContent = carePlan.ems_when || "No EMS guidance";

  oxygenBox.textContent = carePlan.oxygen_guidance || "No oxygen guidance";

  contactsBox.innerHTML = `
  <div>${carePlan.emergency_contacts || ""}</div>
  <div>${carePlan.doctor_contacts || ""}</div>
  <div>${carePlan.preferred_hospital || ""}</div>
  `;

}

async function init(){

  currentUser = await fetchUser();

  if(currentUser?.id){
    children = await fetchChildren(currentUser.id);
  }

  const savedId = getActiveChildId();

  activeChild =
    children.find(c=>String(c.id)===String(savedId)) ||
    children[0] ||
    null;

  if(activeChild){
    setActiveChildId(activeChild.id);
  }

  renderChildSwitcher();
  renderChildSummary();

  if(activeChild){
    carePlan = await fetchCarePlan(activeChild.id);
  }

  renderCarePlan();

  renderTimeline();

}

childSwitcher?.addEventListener("change",async e=>{
  const id=e.target.value;
  activeChild=children.find(c=>String(c.id)===String(id));
  setActiveChildId(id);

  carePlan = await fetchCarePlan(activeChild.id);

  renderChildSummary();
  renderCarePlan();
});

btnStartCrisis?.addEventListener("click",()=>logEvent("Crisis Started"));

btnEndCrisis?.addEventListener("click",()=>logEvent("Crisis Ended"));

btnLogSeizureStart?.addEventListener("click",()=>logEvent("Seizure Started"));

btnLogSeizureEnd?.addEventListener("click",()=>logEvent("Seizure Ended"));

btnLogRescueMed?.addEventListener("click",()=>logEvent("Rescue Medication Given"));

btnLogOxygen?.addEventListener("click",()=>logEvent("Oxygen Started"));

btnLogCallEms?.addEventListener("click",()=>logEvent("EMS Called"));

btnAddNote?.addEventListener("click",()=>{
  const note = prompt("Enter note");
  if(note){
    logEvent(note);
  }
});

btnClearTimeline?.addEventListener("click",()=>{
  saveTimeline([]);
  renderTimeline();
});

logoutBtn?.addEventListener("click",async ()=>{
  const supabase=getSupabaseClient();
  if(supabase?.auth){
    await supabase.auth.signOut();
  }
  window.location.href="login.html";
});

await init();

});
