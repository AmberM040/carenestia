document.addEventListener("DOMContentLoaded", () => {

let db = ensureDB(loadDB())
saveDB(db)

const childSwitcher = document.getElementById("childSwitcher")
const childAvatar = document.getElementById("childAvatar")
const childSummary = document.getElementById("childSummary")

const vitalsList = document.getElementById("vitalsList")

const btnAddVital = document.getElementById("btnAddVital")
const vitalModal = document.getElementById("vitalModal")
const btnCloseVitalModal = document.getElementById("btnCloseVitalModal")
const btnSaveVital = document.getElementById("btnSaveVital")

const vitalTemp = document.getElementById("vitalTemp")
const vitalO2 = document.getElementById("vitalO2")
const vitalHR = document.getElementById("vitalHR")
const vitalRR = document.getElementById("vitalRR")
const vitalBP = document.getElementById("vitalBP")
const vitalNotes = document.getElementById("vitalNotes")

init()

function init(){

if(!Array.isArray(db.vitals))
db.vitals=[]

renderChildSwitcher()
renderHeader()
renderVitals()

wireEvents()

}

function wireEvents(){

childSwitcher.addEventListener("change",()=>{
db.activeChildId=childSwitcher.value
saveDB(db)

renderHeader()
renderVitals()
})

btnAddVital.addEventListener("click",()=>{
vitalModal.classList.remove("hidden")
})

btnCloseVitalModal.addEventListener("click",()=>{
vitalModal.classList.add("hidden")
})

btnSaveVital.addEventListener("click",saveVitals)

}

function getChildren(){
return Array.isArray(db.children)?db.children:[]
}

function getActiveChild(){

const children=getChildren()

return children.find(c=>String(c.id)===String(db.activeChildId)) || children[0]

}

function renderChildSwitcher(){

const children=getChildren()

childSwitcher.innerHTML=children.map(c=>
`<option value="${c.id}" ${c.id===db.activeChildId?"selected":""}>${c.name}</option>`
).join("")

}

function renderHeader(){

const child=getActiveChild()

if(!child)return

childSummary.textContent=`Age ${child.age || "—"}`
childAvatar.innerHTML=child.photo_url?`<img src="${child.photo_url}">`:""

}

function renderVitals(){

const child=getActiveChild()

const list=db.vitals
.filter(v=>String(v.childId)===String(child.id))
.sort((a,b)=>new Date(b.date)-new Date(a.date))
.slice(0,30)

if(!list.length){
vitalsList.innerHTML=`<div class="empty-box">No vitals logged yet.</div>`
return
}

vitalsList.innerHTML=list.map(v=>`

<div class="list-item">

<div>
<strong>${formatDateTime(v.date)}</strong>

<div class="muted">

${v.temp?`Temp ${v.temp}° • `:""}
${v.o2?`O2 ${v.o2}% • `:""}
${v.hr?`HR ${v.hr} • `:""}
${v.rr?`RR ${v.rr} • `:""}
${v.bp?`BP ${v.bp}`:""}

</div>

${v.notes?`<div class="muted">${v.notes}</div>`:""}

</div>

</div>

`).join("")

}

function saveVitals(){

const child=getActiveChild()

db.vitals.unshift({

id:uid("vital"),
childId:child.id,

temp:vitalTemp.value.trim(),
o2:vitalO2.value.trim(),
hr:vitalHR.value.trim(),
rr:vitalRR.value.trim(),
bp:vitalBP.value.trim(),

notes:vitalNotes.value.trim(),

date:new Date().toISOString()

})

saveDB(db)

vitalModal.classList.add("hidden")

clearForm()

renderVitals()

}

function clearForm(){

vitalTemp.value=""
vitalO2.value=""
vitalHR.value=""
vitalRR.value=""
vitalBP.value=""
vitalNotes.value=""

}

function uid(prefix){
return prefix+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,6)
}

function formatDateTime(date){

const d=new Date(date)

return d.toLocaleString([],{
month:"short",
day:"numeric",
hour:"numeric",
minute:"2-digit"
})

}

})