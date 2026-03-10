document.addEventListener("DOMContentLoaded", async () => {

let db = ensureDB(loadDB())
const supabase = window.supabaseClient

const childSwitcher=document.getElementById("childSwitcher")
const childAvatar=document.getElementById("childAvatar")
const childSummary=document.getElementById("childSummary")

const binderPhoto=document.getElementById("binderPhoto")
const binderName=document.getElementById("binderName")
const binderSub=document.getElementById("binderSub")

const binderNav=document.getElementById("binderNav")
const binderSectionContent=document.getElementById("binderSectionContent")

const sectionTitle=document.getElementById("sectionTitle")
const sectionDesc=document.getElementById("sectionDesc")

const editSectionBtn=document.getElementById("editSectionBtn")

const editModal=document.getElementById("editModal")
const editTitle=document.getElementById("editTitle")
const editNotes=document.getElementById("editNotes")

const saveEditBtn=document.getElementById("saveEditBtn")
const cancelEditBtn=document.getElementById("cancelEditBtn")

let editingSection=null

const SECTIONS={

overview:{
label:"Overview",
desc:"Basic snapshot of the child"
},

medicalHistory:{
label:"Medical History",
desc:"Diagnoses surgeries hospitalizations"
},

careTeam:{
label:"Care Team",
desc:"Doctors therapists pharmacy contacts"
},

documents:{
label:"Documents",
desc:"Notes and uploaded summaries"
}

}

init()

async function init(){

await loadChildren()

renderChildSwitcher()

renderHeader()

renderSidebarProfile()

renderBinderNav()

renderSection("overview")

}

async function loadChildren(){

const {data:{user}}=await supabase.auth.getUser()

const {data}=await supabase
.from("children")
.select("*")
.eq("parent_id",user.id)

db.children=data||[]

db.activeChildId=db.children[0]?.id

}

function getActiveChild(){

return db.children.find(c=>c.id==db.activeChildId)

}

function renderChildSwitcher(){

childSwitcher.innerHTML=db.children
.map(c=>`<option value="${c.id}">${c.name}</option>`)
.join("")

childSwitcher.addEventListener("change",()=>{
db.activeChildId=childSwitcher.value
renderHeader()
renderSidebarProfile()
})

}

function renderHeader(){

const child=getActiveChild()

if(!child)return

childSummary.innerText=`Age ${child.age||"—"}`

childAvatar.innerHTML=child.photo_url
?`<img src="${child.photo_url}">`
:""

}

function renderSidebarProfile(){

const child=getActiveChild()

binderPhoto.src=child.photo_url||"https://via.placeholder.com/600x400"

binderName.innerText=child.name

binderSub.innerText=`Age ${child.age||"—"}`

}

function renderBinderNav(){

binderNav.innerHTML=Object.keys(SECTIONS)
.map(k=>`<a data-section="${k}">${SECTIONS[k].label}</a>`)
.join("")

binderNav.querySelectorAll("a").forEach(link=>{
link.onclick=()=>{
renderSection(link.dataset.section)
}
})

}

function renderSection(key){

const cfg=SECTIONS[key]

sectionTitle.innerText=cfg.label

sectionDesc.innerText=cfg.desc

const notes=db.careBinder?.sections?.[key]?.notes||""

binderSectionContent.innerHTML=

`<div class="card">
<div class="kv-row">
<div class="muted">Notes</div>
<div>${notes||"No notes yet"}</div>
</div>
</div>`

editSectionBtn.onclick=()=>openEdit(key)

}

function openEdit(key){

editingSection=key

editTitle.innerText=`Edit ${SECTIONS[key].label}`

editNotes.value=db.careBinder?.sections?.[key]?.notes||""

editModal.classList.add("open")

}

cancelEditBtn.onclick=()=>editModal.classList.remove("open")

saveEditBtn.onclick=()=>{

if(!db.careBinder)db.careBinder={sections:{}}

if(!db.careBinder.sections[editingSection])
db.careBinder.sections[editingSection]={}

db.careBinder.sections[editingSection].notes=editNotes.value

saveDB(db)

renderSection(editingSection)

editModal.classList.remove("open")

}

})
