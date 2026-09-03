/* ================= i18n =================
   Aggiungere una lingua = aggiungere una voce in LANGS e il blocco
   corrispondente in DICT con le stesse chiavi. Le chiavi mancanti
   ricadono automaticamente sull'italiano, quindi una traduzione
   parziale non rompe nulla.
   La lingua scelta e' ricordata in localStorage e riapplicata all'avvio.
========================================== */

export const LANGS = { it:'Italiano', en:'English' };
const FALLBACK = 'it';
const STORE_KEY = 'matstudio.lang';
const LOCALES = { it:'it-IT', en:'en-GB' };

const DICT = {
it:{
  'app.title':'Material Studio — assegnazione materiali',

  'hdr.load':'Carica modello',
  'hdr.addTex':'Aggiungi texture',
  'hdr.link':'Auto-salva su file',
  'hdr.link.t':'Salvataggio automatico su un file .json del disco',
  'hdr.saveLocal':'Salva nel browser',
  'hdr.openLocal':'Apri salvato',
  'hdr.import':'Importa .json',
  'hdr.export':'Esporta .json',
  'hdr.png':'PNG',
  'hdr.lang.t':'Lingua dell’interfaccia',

  'left.objects':'Oggetti',
  'left.filter.ph':'filtra per nome (più parole = AND)…',
  'left.visOnly':'visibili',
  'left.visOnly.t':'mostra solo le prop non nascoste',
  'left.expAll.t':'espandi tutti i gruppi',
  'left.colAll.t':'comprimi tutti i gruppi',
  'left.similar':'Seleziona simili',
  'left.all':'Tutti',
  'left.hide':'Nascondi',
  'left.hide.t':'Nascondi la selezione (H)',
  'left.iso':'Isola',
  'left.iso.t':'Mostra solo la selezione (I)',
  'left.showAll':'Mostra tutto',
  'left.showAll.t':'Mostra tutto (U)',
  'left.sections':'Sezioni',
  'left.secNew':'＋ Crea sezione da selezione',

  'vp.drop':'rilascia qui il modello o le texture',

  'r.selProp':'Prop selezionata',
  'r.noSel':'Clicca una prop nella vista 3D o nell’elenco a sinistra.',
  'r.curMat':'Materiale corrente — clicca per cambiarlo',
  'r.props':'Proprietà',
  'r.name':'Nome',
  'r.color':'Colore',
  'r.metal':'Metal',
  'r.rough':'Rough',
  'r.opacity':'Opacità',
  'r.tiling':'Tiling U/V',
  'r.normal':'Normal ×',
  'r.maps':'Mappe',
  'r.texBtn':'Texture',
  'r.texBtn.t':'Libreria texture',
  'r.revert':'Ripristina originale FBX',
  'r.apply':'Applica',
  'r.applySel':'Applica alla selezione ({n})',
  'r.applySelEmpty':'Applica alla selezione',
  'r.applyChanges':'Applica modifiche',
  'mat.default':'Materiale {n}',
  'mat.copy':'{name} copia',

  'env.title':'Ambiente',
  'env.preset':'Preset',
  'env.p.studio':'Studio neutro',
  'env.p.giorno':'Mezzogiorno',
  'env.p.velato':'Cielo coperto',
  'env.p.tramonto':'Tramonto',
  'env.p.hdri':'HDRI da file…',
  'env.loadHdr':'Carica .hdr',
  'env.rotation':'Rotazione',

  'sun.title':'Sole',
  'sun.place':'Luogo',
  'sun.custom':'personalizzato',
  'sun.north':'Nord ↺',
  'sun.reset':'Azzera',
  'sun.reset.t':'allinea il nord all’asse -Z',
  'sun.plus90':'+90°',
  'sun.latlon':'Lat / Lon',
  'sun.date':'Data',
  'sun.hour':'Ora',
  'sun.modelRot':'Ruota FBX',

  'rend.title':'Resa',
  'rend.speed':'Velocità',
  'rend.expo':'Esposizione',
  'rend.ambient':'Ambiente',
  'rend.shadows':'ombre',
  'rend.grid':'griglia',
  'rend.sky':'cielo',
  'rend.help':'WASD = muovi verso dove guardi · Q/E = scendi/sali (velocità nel pannello Resa)<br>' +
    'Tasto destro = ruota la visuale sul posto · sinistro trascinato = pan · rotella = zoom<br>' +
    'Click sinistro = seleziona · Shift+click = aggiungi · Doppio click = zoom sulla prop<br>' +
    'H = nascondi · I = isola · U = mostra tutto · M = materiali · T = texture · Invio = applica<br>' +
    'Ctrl+Z = annulla · Ctrl+Y = ripristina · Tab = naviga l’elenco da tastiera',

  'mp.title':'LIBRERIA MATERIALI',
  'mp.filter.ph':'filtra per nome…',
  'mp.new':'Nuovo',
  'mp.dup':'Duplica',
  'mp.del':'Elimina',
  'mp.close':'Chiudi',
  'tp.filter.ph':'filtra per nome…',
  'tp.add':'Aggiungi file',
  'tp.close':'Chiudi',

  /* ---- stringhe dinamiche ---- */
  'msg.loadErr':'Errore nel caricamento: {ext}',
  'msg.unsupported':'Formato non supportato',
  'msg.loaded':'{n} mesh, {m} materiali in libreria',
  'msg.reverted':'Materiale riportato all’originale',
  'msg.matApplied':'"{name}" applicato a {n} prop',
  'msg.noMat':'Nessun materiale selezionato',
  'msg.selectMeshes':'Seleziona le mesh da assegnare',
  'msg.appliedTo':'Applicato a {n} mesh',
  'msg.changesApplied':'Modifiche applicate',
  'btn.undo':'Annulla',
  'msg.secDeleted':'Sezione «{name}» eliminata',
  'msg.undone':'Annullato: {what}',
  'msg.redone':'Ripristinato: {what}',
  'msg.nothingUndo':'Niente da annullare',
  'msg.nothingRedo':'Niente da ripristinare',
  'undo.assign':'assegnazione materiale',
  'undo.hide':'nascondi prop',
  'undo.isolate':'isola selezione',
  'undo.showAll':'mostra tutto',
  'undo.hideProp':'nascondi prop',
  'undo.showProp':'mostra prop',
  'undo.hideGroup':'nascondi gruppo',
  'undo.showGroup':'mostra gruppo',
  'undo.delSection':'elimina sezione',
  'msg.texAdded':'{n} texture in libreria',
  'msg.texSkipped':'Non caricabili: {list}',
  'msg.needHdr':'Carica un file .hdr equirettangolare',
  'msg.hdrLoaded':'HDRI caricato: {name}',
  'msg.hdrUnreadable':'HDR non leggibile (serve .hdr Radiance)',
  'msg.projLoaded':'Progetto caricato',
  'msg.projLoadedWith':'Progetto caricato · modello atteso: {name}',
  'msg.needChrome':'Serve Chrome o Edge, e la pagina aperta via http://localhost',
  'msg.linked':'Collegato: ogni modifica finisce in questo file',
  'msg.savedAs':'Salvato: {name}',
  'msg.noSaved':'Nessun progetto salvato',
  'msg.notFound':'Non trovato',
  'msg.secEmptyModel':'Sezione vuota: le prop non sono nel modello caricato',
  'msg.exported':'Esportati {views} e {brief}',
  'msg.secEmpty':'Sezione vuota',
  'msg.glbExported':'GLB esportato',
  'msg.glbFailed':'Export GLB fallito',
  'msg.selectPropsFirst':'Seleziona prima le prop dell’ambiente',
  'msg.secCreated':'Sezione "{name}" · {n} prop',
  'msg.fileProtocol':'Aperto da file://: il browser blocca la memoria locale. ' +
    'Servi la cartella con "python -m http.server" e apri http://localhost:8000',

  'stat.savedFile':'salvato su file {time}',
  'stat.fileNotWritable':'file non scrivibile',
  'stat.savedBrowser':'salvato nel browser {time}',
  'stat.saveUnavailable':'salvataggio non disponibile',
  'stat.fileLinked':'file collegato: clicca "Auto-salva" per riattivarlo',
  'stat.resumed':'lavoro ripreso',
  'stat.warnFile':'attenzione: aperto da file://',
  'stat.ready':'pronto',
  'stat.noMemory':'memoria non disponibile: usa Esporta .json',

  'prompt.projName':'Nome progetto',
  'prompt.open':'Apri:',
  'prompt.secName':'Nome sezione',
  'confirm.delSection':'Eliminare "{name}"?',
  'confirm.delTexture':'Eliminare "{name}"?',

  'tree.show':'mostra',
  'tree.hide':'nascondi',
  'tree.hiddenCount':'{n} nascoste',
  'tree.selUsers.t':'seleziona le prop che usano questo materiale',
  'sel.props':'{n} prop',
  'hud':'{name} · {mesh} mesh · {mats} materiali importati · {nouv} senza UV (box-projection)',

  'card.multiMat':'materiali diversi',
  'card.noMat':'nessun materiale',
  'card.pending':'· da applicare',
  'card.original':'· originale',
  'card.modified':'· modificato',
  'list.noMats':'Nessun materiale. Carica un modello o premi "Nuovo".',
  'list.noNameMatch':'Nessun nome contiene "{q}".',
  'pick.empty':'Libreria vuota. Usa "Aggiungi file" o trascina le immagini nella vista 3D. ' +
    'TGA supportato; TIFF/DDS/EXR vanno convertiti in PNG o JPG.',
  'pick.del.t':'elimina',
  'slot.choose.t':'scegli dalla libreria',
  'slot.useOrig.t':'usa quella del file originale',
  'slot.none.t':'nessuna',
  'slot.none':'nessuna',
  'slot.origFbx':'originale FBX',
  'tex.convert':' (converti in PNG/JPG)',

  'file.projDesc':'Progetto Material Studio',
  'file.project':'progetto',
  'file.render':'render',
  'file.section':'sezione',
  'file.room':'Ambiente',
  'file.viewsSuffix':'_viste.png',
  'file.briefSuffix':'_brief.md',

  'sec.hint':'Seleziona le prop di un ambiente e premi "Crea sezione da selezione".',
  'sec.viewsBrief':'Viste + brief',
  'sec.viewsBrief.t':'PNG con 6 viste + brief markdown per la chat AI',
  'sec.glb':'GLB',

  'views.plan':'Pianta (taglio 1,6 m)',
  'views.north':'Prospetto Nord',
  'views.south':'Prospetto Sud',
  'views.east':'Prospetto Est',
  'views.west':'Prospetto Ovest',
  'views.persp':'Vista prospettica',
  'sheet.footprint':'Ingombro {x} × {z} m · altezza {y} m',

  'brief.title':'# Sezione: {name}',
  'brief.intro':'Estratta dal modello architettonico **{model}**. Le immagini allegate (`{file}`) ' +
    'contengono pianta con taglio orizzontale, quattro prospetti ortogonali e una vista prospettica, ' +
    'tutti dello stesso volume.',
  'brief.noName':'senza nome',
  'brief.dimsH':'## Dimensioni',
  'brief.thQty':'grandezza',
  'brief.thVal':'valore',
  'brief.width':'larghezza (X)',
  'brief.depth':'profondità (Z)',
  'brief.height':'altezza (Y)',
  'brief.floorArea':'superficie in pianta',
  'brief.volume':'volume lordo',
  'brief.elements':'elementi (prop)',
  'brief.matsH':'## Materiali attuali',
  'brief.matsNote':'Superfici stimate dalla geometria; il nord del modello è ruotato di {n}° rispetto all’asse -Z delle viste.',
  'brief.thMat':'materiale',
  'brief.thArea':'superficie',
  'brief.thShare':'quota',
  'brief.unassigned':'(non assegnato)',
  'brief.ctxH':'## Contesto ambientale',
  'brief.loc':'- Località: lat {lat}°, lon {lon}°',
  'brief.solar':'- Studio solare impostato al {d}/{m}, ore {h}',
  'brief.northRot':'- Rotazione nord: {n}°',
  'brief.reqH':'## Richiesta',
  'brief.req':'Proponi un concept di interior design per questo volume. Vincoli: rispetta le dimensioni ' +
    'indicate, mantieni la posizione delle aperture visibili nei prospetti e indica per ogni superficie ' +
    '(pavimento, pareti, soffitto, serramenti) il materiale, la finitura e il colore proposti, motivando ' +
    'le scelte rispetto all’orientamento e alla luce naturale.'
},

en:{
  'app.title':'Material Studio — material assignment',

  'hdr.load':'Load model',
  'hdr.addTex':'Add textures',
  'hdr.link':'Auto-save to file',
  'hdr.link.t':'Automatic saving to a .json file on disk',
  'hdr.saveLocal':'Save in browser',
  'hdr.openLocal':'Open saved',
  'hdr.import':'Import .json',
  'hdr.export':'Export .json',
  'hdr.png':'PNG',
  'hdr.lang.t':'Interface language',

  'left.objects':'Objects',
  'left.filter.ph':'filter by name (multiple words = AND)…',
  'left.visOnly':'visible',
  'left.visOnly.t':'show only non-hidden props',
  'left.expAll.t':'expand all groups',
  'left.colAll.t':'collapse all groups',
  'left.similar':'Select similar',
  'left.all':'All',
  'left.hide':'Hide',
  'left.hide.t':'Hide the selection (H)',
  'left.iso':'Isolate',
  'left.iso.t':'Show only the selection (I)',
  'left.showAll':'Show all',
  'left.showAll.t':'Show all (U)',
  'left.sections':'Sections',
  'left.secNew':'＋ New section from selection',

  'vp.drop':'drop the model or the textures here',

  'r.selProp':'Selected prop',
  'r.noSel':'Click a prop in the 3D view or in the list on the left.',
  'r.curMat':'Current material — click to change it',
  'r.props':'Properties',
  'r.name':'Name',
  'r.color':'Colour',
  'r.metal':'Metal',
  'r.rough':'Rough',
  'r.opacity':'Opacity',
  'r.tiling':'Tiling U/V',
  'r.normal':'Normal ×',
  'r.maps':'Maps',
  'r.texBtn':'Textures',
  'r.texBtn.t':'Texture library',
  'r.revert':'Restore FBX original',
  'r.apply':'Apply',
  'r.applySel':'Apply to selection ({n})',
  'r.applySelEmpty':'Apply to selection',
  'r.applyChanges':'Apply changes',
  'mat.default':'Material {n}',
  'mat.copy':'{name} copy',

  'env.title':'Environment',
  'env.preset':'Preset',
  'env.p.studio':'Neutral studio',
  'env.p.giorno':'Midday',
  'env.p.velato':'Overcast sky',
  'env.p.tramonto':'Sunset',
  'env.p.hdri':'HDRI from file…',
  'env.loadHdr':'Load .hdr',
  'env.rotation':'Rotation',

  'sun.title':'Sun',
  'sun.place':'Location',
  'sun.custom':'custom',
  'sun.north':'North ↺',
  'sun.reset':'Reset',
  'sun.reset.t':'align north with the -Z axis',
  'sun.plus90':'+90°',
  'sun.latlon':'Lat / Lon',
  'sun.date':'Date',
  'sun.hour':'Time',
  'sun.modelRot':'Rotate FBX',

  'rend.title':'Rendering',
  'rend.speed':'Speed',
  'rend.expo':'Exposure',
  'rend.ambient':'Ambient',
  'rend.shadows':'shadows',
  'rend.grid':'grid',
  'rend.sky':'sky',
  'rend.help':'WASD = move where you look · Q/E = down/up (speed in the Rendering panel)<br>' +
    'Right button = look around in place · left button dragged = pan · wheel = zoom<br>' +
    'Left click = select · Shift+click = add · Double click = zoom on the prop<br>' +
    'H = hide · I = isolate · U = show all · M = materials · T = textures · Enter = apply<br>' +
    'Ctrl+Z = undo · Ctrl+Y = redo · Tab = navigate the list by keyboard',

  'mp.title':'MATERIAL LIBRARY',
  'mp.filter.ph':'filter by name…',
  'mp.new':'New',
  'mp.dup':'Duplicate',
  'mp.del':'Delete',
  'mp.close':'Close',
  'tp.filter.ph':'filter by name…',
  'tp.add':'Add files',
  'tp.close':'Close',

  'msg.loadErr':'Loading failed: {ext}',
  'msg.unsupported':'Unsupported format',
  'msg.loaded':'{n} meshes, {m} materials in the library',
  'msg.reverted':'Material restored to the original',
  'msg.matApplied':'"{name}" applied to {n} props',
  'msg.noMat':'No material selected',
  'msg.selectMeshes':'Select the meshes to assign',
  'msg.appliedTo':'Applied to {n} meshes',
  'msg.changesApplied':'Changes applied',
  'btn.undo':'Undo',
  'msg.secDeleted':'Section “{name}” deleted',
  'msg.undone':'Undone: {what}',
  'msg.redone':'Redone: {what}',
  'msg.nothingUndo':'Nothing to undo',
  'msg.nothingRedo':'Nothing to redo',
  'undo.assign':'material assignment',
  'undo.hide':'hide props',
  'undo.isolate':'isolate selection',
  'undo.showAll':'show all',
  'undo.hideProp':'hide prop',
  'undo.showProp':'show prop',
  'undo.hideGroup':'hide group',
  'undo.showGroup':'show group',
  'undo.delSection':'delete section',
  'msg.texAdded':'{n} textures in the library',
  'msg.texSkipped':'Could not load: {list}',
  'msg.needHdr':'Load an equirectangular .hdr file',
  'msg.hdrLoaded':'HDRI loaded: {name}',
  'msg.hdrUnreadable':'HDR unreadable (a Radiance .hdr is required)',
  'msg.projLoaded':'Project loaded',
  'msg.projLoadedWith':'Project loaded · expected model: {name}',
  'msg.needChrome':'Requires Chrome or Edge, with the page served over http://localhost',
  'msg.linked':'Linked: every change goes into this file',
  'msg.savedAs':'Saved: {name}',
  'msg.noSaved':'No saved project',
  'msg.notFound':'Not found',
  'msg.secEmptyModel':'Empty section: those props are not in the loaded model',
  'msg.exported':'Exported {views} and {brief}',
  'msg.secEmpty':'Empty section',
  'msg.glbExported':'GLB exported',
  'msg.glbFailed':'GLB export failed',
  'msg.selectPropsFirst':'Select the props of the room first',
  'msg.secCreated':'Section "{name}" · {n} props',
  'msg.fileProtocol':'Opened from file://: the browser blocks local storage. ' +
    'Serve the folder with "python -m http.server" and open http://localhost:8000',

  'stat.savedFile':'saved to file {time}',
  'stat.fileNotWritable':'file not writable',
  'stat.savedBrowser':'saved in browser {time}',
  'stat.saveUnavailable':'saving unavailable',
  'stat.fileLinked':'file linked: click "Auto-save" to re-enable it',
  'stat.resumed':'work resumed',
  'stat.warnFile':'warning: opened from file://',
  'stat.ready':'ready',
  'stat.noMemory':'storage unavailable: use Export .json',

  'prompt.projName':'Project name',
  'prompt.open':'Open:',
  'prompt.secName':'Section name',
  'confirm.delSection':'Delete "{name}"?',
  'confirm.delTexture':'Delete "{name}"?',

  'tree.show':'show',
  'tree.hide':'hide',
  'tree.hiddenCount':'{n} hidden',
  'tree.selUsers.t':'select the props using this material',
  'sel.props':'{n} props',
  'hud':'{name} · {mesh} meshes · {mats} imported materials · {nouv} without UV (box-projection)',

  'card.multiMat':'mixed materials',
  'card.noMat':'no material',
  'card.pending':'· to apply',
  'card.original':'· original',
  'card.modified':'· modified',
  'list.noMats':'No materials. Load a model or press "New".',
  'list.noNameMatch':'No name contains "{q}".',
  'pick.empty':'Empty library. Use "Add files" or drag images into the 3D view. ' +
    'TGA is supported; TIFF/DDS/EXR must be converted to PNG or JPG.',
  'pick.del.t':'delete',
  'slot.choose.t':'pick from the library',
  'slot.useOrig.t':'use the one from the original file',
  'slot.none.t':'none',
  'slot.none':'none',
  'slot.origFbx':'FBX original',
  'tex.convert':' (convert to PNG/JPG)',

  'file.projDesc':'Material Studio project',
  'file.project':'project',
  'file.render':'render',
  'file.section':'section',
  'file.room':'Room',
  'file.viewsSuffix':'_views.png',
  'file.briefSuffix':'_brief.md',

  'sec.hint':'Select the props of a room and press "New section from selection".',
  'sec.viewsBrief':'Views + brief',
  'sec.viewsBrief.t':'PNG with 6 views + markdown brief for the AI chat',
  'sec.glb':'GLB',

  'views.plan':'Plan (cut at 1.6 m)',
  'views.north':'North elevation',
  'views.south':'South elevation',
  'views.east':'East elevation',
  'views.west':'West elevation',
  'views.persp':'Perspective view',
  'sheet.footprint':'Footprint {x} × {z} m · height {y} m',

  'brief.title':'# Section: {name}',
  'brief.intro':'Extracted from the architectural model **{model}**. The attached images (`{file}`) ' +
    'contain a plan with a horizontal cut, four orthographic elevations and one perspective view, ' +
    'all of the same volume.',
  'brief.noName':'unnamed',
  'brief.dimsH':'## Dimensions',
  'brief.thQty':'quantity',
  'brief.thVal':'value',
  'brief.width':'width (X)',
  'brief.depth':'depth (Z)',
  'brief.height':'height (Y)',
  'brief.floorArea':'floor area',
  'brief.volume':'gross volume',
  'brief.elements':'elements (props)',
  'brief.matsH':'## Current materials',
  'brief.matsNote':'Areas estimated from the geometry; the model north is rotated {n}° from the -Z axis of the views.',
  'brief.thMat':'material',
  'brief.thArea':'area',
  'brief.thShare':'share',
  'brief.unassigned':'(unassigned)',
  'brief.ctxH':'## Environmental context',
  'brief.loc':'- Location: lat {lat}°, lon {lon}°',
  'brief.solar':'- Solar study set to {d}/{m}, {h}',
  'brief.northRot':'- North rotation: {n}°',
  'brief.reqH':'## Request',
  'brief.req':'Propose an interior design concept for this volume. Constraints: respect the dimensions ' +
    'given, keep the position of the openings visible in the elevations, and for every surface ' +
    '(floor, walls, ceiling, openings) state the proposed material, finish and colour, justifying ' +
    'the choices against the orientation and the natural light.'
}
};

function detect(){
  try{ const s=localStorage.getItem(STORE_KEY); if(s&&DICT[s]) return s; }catch(e){}
  const n=(navigator.language||'').slice(0,2).toLowerCase();
  return DICT[n]?n:FALLBACK;
}

export let lang = detect();

export function locale(){ return LOCALES[lang]||LOCALES[FALLBACK]; }

/* T('msg.loaded',{n:12,m:3}) */
export function T(key,params){
  let s = DICT[lang][key];
  if(s===undefined) s = DICT[FALLBACK][key];
  if(s===undefined) return key;          // chiave non tradotta: la mostro nuda, cosi' si nota subito
  if(params) for(const k in params) s = s.split('{'+k+'}').join(params[k]);
  return s;
}

export function setLang(l){
  if(!DICT[l]) return false;
  lang = l;
  // file:// puo' negare localStorage: in quel caso la lingua vale per la sessione e basta
  try{ localStorage.setItem(STORE_KEY,l); }catch(e){}
  return true;
}

/* Traduce il markup statico.
   data-i18n       -> textContent
   data-i18n-html  -> innerHTML (testi con <br>)
   data-i18n-title -> title
   data-i18n-ph    -> placeholder */
export function applyI18n(root=document){
  root.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=T(e.dataset.i18n));
  root.querySelectorAll('[data-i18n-html]').forEach(e=>e.innerHTML=T(e.dataset.i18nHtml));
  root.querySelectorAll('[data-i18n-title]').forEach(e=>e.title=T(e.dataset.i18nTitle));
  root.querySelectorAll('[data-i18n-ph]').forEach(e=>e.placeholder=T(e.dataset.i18nPh));
  if(root===document){
    document.title = T('app.title');
    document.documentElement.lang = lang;
  }
}
