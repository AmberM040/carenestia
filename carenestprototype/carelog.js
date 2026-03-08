document.addEventListener("DOMContentLoaded", () => {

let db = ensureDB(loadDB());
saveDB(db);

const childSummary = document.getElementById("childSummary");
const childSwitcher = document.getElementById("childSwitcher");

const searchInput = document.getElementById("searchInput");
const specialtyFilter = document.getElementById("specialtyFilter");
const daysFilter = document.getElementById("daysFilter");

const category = document.getElementById("category");
const logDate = document.getElementById("logDate");
const logTime = document.getElementById("logTime");
const note = document.getElementById("note");
const author = document.getElementById("author");
const carelogSpecialtyChecks = document.getElementById("carelogSpecialtyChecks");

const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");

const timeline = document.getElementById("timeline");

const btnAddLog = document.getElementById("btnAddLog");
const btnCloseModal = document.getElementById("btnCloseModal");
const modal = document.getElementById("modal");

const btnClearFilters = document.getElementById("btnClearFilters");

function activeChild(){
return getActiveChild(db);
}

function getAvailableSpecialties(){

const child = activeChild();

if(Array.isArray(child?.selectedSpecialties) && child.selectedSpecialties.length){
return child.selectedSpecialties;
}

if(Array.isArray(db.specialties)){
return db.specialties;
}

return ["General"];

}

function renderSpecialties(){

const specialties = getAvailableSpecialties();

carelogSpecialtyChecks.innerHTML = "";

specialties.forEach(s=>{

const label = document.createElement("label");

label.className = "chip";

label.innerHTML = `
<input type="checkbox" value="${s}">
<span>${s}</span>
`;

carelogSpecialtyChecks.appendChild(label);

});

specialtyFilter.innerHTML = `<option value="all">All Specialties</option>`;

specialties.forEach(s=>{

const o = document.createElement("option");
o.value = s;
o.textContent = s;
specialtyFilter.appendChild(o);

});

}

function setDefaultTime(){

const now = new Date();

logDate.value = now.toISOString().slice(0,10);

logTime.value = now.toTimeString().slice(0,5);

}

function openModal(){

modal.classList.remove("hidden");

}

function closeModal(){

modal.classList.add("hidden");

}

btnAddLog.addEventListener("click",()=>{

setDefaultTime();
note.value="";
openModal();

});

btnCloseModal.addEventListener("click",closeModal);

modal.addEventListener("click",(e)=>{
if(e.target===modal) closeModal();
});


function getSelectedSpecialties(){

const selected=[...carelogSpecialtyChecks.querySelectorAll("input:checked")].map(x=>x.value);

return selected.length ? selected : ["General"];

}

function buildEntry(){

return{

id:crypto.randomUUID(),

category:category.value,

note:note.value,

author:author.value,

specialties:getSelectedSpecialties(),

createdAt:new Date(`${logDate.value}T${logTime.value}`).toISOString()

};

}

function saveEntry(){

if(!note.value.trim()){
saveStatus.textContent="Enter a note";
return;
}

const child = activeChild();

if(!db.logs) db.logs={};
if(!db.logs[child.id]) db.logs[child.id]=[];

db.logs[child.id].unshift(buildEntry());

saveDB(db);

renderTimeline();

closeModal();

saveStatus.textContent="Saved";

}

saveBtn.addEventListener("click",saveEntry);


function matchesFilters(entry){

const q = searchInput.value.toLowerCase();

if(q && !entry.note.toLowerCase().includes(q)) return false;

if(specialtyFilter.value!=="all" && !entry.specialties.includes(specialtyFilter.value)) return false;

if(daysFilter.value!=="all"){

const days = Number(daysFilter.value);

const cutoff = Date.now() - days*86400000;

if(new Date(entry.createdAt).getTime() < cutoff) return false;

}

return true;

}

function renderTimeline(){

const child = activeChild();

if(!child){
timeline.innerHTML="";
return;
}

const logs = (db.logs?.[child.id]||[]).filter(matchesFilters);

timeline.innerHTML="";

logs.forEach(entry=>{

const card=document.createElement("div");

card.className="log-card";

card.innerHTML=`

<div class="log-icon general">📝</div>

<div class="log-main">

<h3>${entry.note}</h3>

<p class="muted">${entry.author} • ${new Date(entry.createdAt).toLocaleString()}</p>

<p class="muted">Specialties: ${entry.specialties.join(", ")}</p>

</div>

`;

timeline.appendChild(card);

});

}

searchInput.addEventListener("input",renderTimeline);
specialtyFilter.addEventListener("change",renderTimeline);
daysFilter.addEventListener("change",renderTimeline);
btnClearFilters.addEventListener("click",()=>{

searchInput.value="";
specialtyFilter.value="all";
daysFilter.value="all";

renderTimeline();

});


function fillChildSwitcher(){

childSwitcher.innerHTML="";

db.children.forEach(child=>{

const o=document.createElement("option");
o.value=child.id;
o.textContent=child.name;

childSwitcher.appendChild(o);

});

childSwitcher.value=db.activeChildId;

}

childSwitcher.addEventListener("change",()=>{

db.activeChildId=childSwitcher.value;

saveDB(db);

renderTimeline();

});

function updateChildSummary(){

const child = activeChild();

childSummary.textContent = `${child.name} • Age ${child.age}`;

}

function init(){

fillChildSwitcher();

updateChildSummary();

renderSpecialties();

renderTimeline();

setDefaultTime();

}

init();

});
