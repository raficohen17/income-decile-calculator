'use strict';
// Parameters and pure calculation. Update the values between CALC-START and CALC-END each tax year.
//CALC-START
var SCALE=[0,1.25,2.00,2.65,3.20,3.75,4.25,4.75,5.20];
function stdPersons(n){if(n<=0)return 0;if(n<=8)return SCALE[n];return 5.20+0.40*(n-8);}
var BRACKETS=[[7010,.10],[10060,.14],[19000,.20],[25100,.31],[46690,.35],[60130,.47],[Infinity,.50]];
var POINT=242;
var KID_KEYS=['g0','g12','g3','g45','g617'];
var PTS_MOTHER=[2.5,4.5,3.5,2.5,2];
var PTS_FATHER=[2.5,4.5,3.5,2.5,1];
var STUDY_CEIL=15712; // monthly salary ceiling for tax-exempt study-fund deposits
var STUDY_EMP=0.025;  // employee share; employer 7.5% up to the ceiling is tax-free, so it has no tax effect
var DECILE_UPPER=[3158,4537,5597,6665,7912,9157,10550,12606,15869];
function taxBeforeCredits(g){var t=0,prev=0;for(var i=0;i<BRACKETS.length;i++){var cap=BRACKETS[i][0],r=BRACKETS[i][1];if(g>prev)t+=(Math.min(g,cap)-prev)*r;prev=cap;}return t;}
function niHealth(g){var lo=Math.min(g,7703),hi=Math.max(0,Math.min(g,51910)-7703);return{ni:lo*.0104+hi*.07,health:lo*.0323+hi*.0517};}
function childAllowance(k){var a=[173,219,219,219],s=0;for(var i=0;i<k;i++)s+=i<4?a[i]:173;return s;}
function calcPerson(a,single,kids,totalKids){
  if(a.mode==='net')return{netMode:true,gross:null,tax:0,ni:0,health:0,net:a.salary,points:null,pension:0,study:0};
  var g=a.salary;
  var col=(single||a.gender==='f')?PTS_MOTHER:PTS_FATHER,kp=0;
  for(var i=0;i<KID_KEYS.length;i++)kp+=(kids[KID_KEYS[i]]||0)*col[i];
  var points=2.25+(a.gender==='f'?0.5:0)+kp+((single&&totalKids>0)?1:0)+a.extraPts;
  var pension=g*a.pension/100;
  var pensionCredit=0.35*Math.min(pension,g*0.07,679);
  var tax=Math.max(0,taxBeforeCredits(g)-points*POINT-pensionCredit);
  var study=a.study?STUDY_EMP*Math.min(g,STUDY_CEIL):0;
  var nh=niHealth(g);
  return{netMode:false,gross:g,tax:tax,ni:nh.ni,health:nh.health,net:g-tax-nh.ni-nh.health,points:points,pension:pension,study:study};
}
function calcHousehold(inp){
  var kidsTotal=0;KID_KEYS.forEach(function(k){kidsTotal+=inp.kids[k]||0;});
  var single=!inp.couple,nAdults=single?1:2;
  var persons=nAdults+kidsTotal+inp.extra,std=stdPersons(persons);
  var people=[];for(var i=0;i<nAdults;i++)people.push(calcPerson(inp.adults[i],single,inp.kids,kidsTotal));
  var salaryNet=0,pensionSum=0,studySum=0;people.forEach(function(p){salaryNet+=p.net;pensionSum+=p.pension;studySum+=p.study;});
  var child=inp.autoChild?childAllowance(kidsTotal):inp.childManual;
  var other=child+inp.allowances+inp.pensionIncome+inp.capital+inp.other;
  var total=salaryNet-(inp.deductPension?pensionSum+studySum:0)+other;
  var pc=std?total/std:0;
  var f=1+inp.adjPct/100,thr=DECILE_UPPER.map(function(x){return x*f;});
  var d=10;for(var j=0;j<thr.length;j++){if(pc<=thr[j]){d=j+1;break;}}
  return{kidsTotal:kidsTotal,persons:persons,std:std,people:people,salaryNet:salaryNet,pensionSum:pensionSum,studySum:studySum,child:child,other:other,total:total,pc:pc,thr:thr,decile:d};
}
//CALC-END

if(typeof module!=='undefined'&&module.exports){
  module.exports={stdPersons:stdPersons,taxBeforeCredits:taxBeforeCredits,niHealth:niHealth,childAllowance:childAllowance,calcPerson:calcPerson,calcHousehold:calcHousehold};
}

if(typeof document!=='undefined')(function(){
var $=function(s){return document.querySelector(s);};
var fmt=function(n){return Math.round(n).toLocaleString('he-IL');};
var KID_LABELS=['נולדו ב-2026 (גיל 0)','גיל 1–2','גיל 3','גיל 4–5','גיל 6–17'];
var state={kids:{g0:0,g12:0,g3:0,g45:1,g617:1},extra:0};
var MAX_PCT=1000; // sanity cap on the threshold adjustment

// All markup below is built only from constants and numbers, never from user-typed text.
function stepperHTML(id,val,label){return '<div class="stepper" data-step="'+id+'"><button type="button" data-dir="-1" aria-label="הפחת '+label+'">−</button><output aria-live="polite">'+val+'</output><button type="button" data-dir="1" aria-label="הוסף '+label+'">+</button></div>';}
$('#kids').innerHTML=KID_KEYS.map(function(k,i){return '<div class="kid"><span class="t">'+KID_LABELS[i]+'</span>'+stepperHTML(k,state.kids[k],KID_LABELS[i])+'</div>';}).join('');

var ADULT_DEFAULT=[{g:'f',s:14000},{g:'m',s:11000}];
var ADULT_NAMES=['בן/בת זוג א','בן/בת זוג ב'];
$('#adults').innerHTML=[0,1].map(function(i){
  var d=ADULT_DEFAULT[i];
  return '<div class="adult" id="adult'+i+'"><h3 class="aname">'+ADULT_NAMES[i]+'</h3>'+
  '<div class="stack"><div class="row">'+
  '<fieldset><legend>מין (לנקודות זיכוי)</legend><div class="seg"><label><input type="radio" name="g'+i+'" value="f"'+(d.g==='f'?' checked':'')+'><span>אישה</span></label><label><input type="radio" name="g'+i+'" value="m"'+(d.g==='m'?' checked':'')+'><span>גבר</span></label></div></fieldset>'+
  '<fieldset><legend>סוג ההזנה</legend><div class="seg"><label><input type="radio" name="m'+i+'" value="gross" checked><span>ברוטו</span></label><label><input type="radio" name="m'+i+'" value="net"><span>נטו</span></label></div></fieldset></div>'+
  '<div class="row"><div><label class="lbl" for="sal'+i+'">שכר חודשי</label><div class="unit"><input type="number" inputmode="decimal" id="sal'+i+'" min="0" step="100" value="'+d.s+'"></div></div>'+
  '<div class="pwrap" id="pw'+i+'"><label class="lbl" for="pen'+i+'">הפרשת עובד לפנסיה</label><div class="unit pct"><input type="number" inputmode="decimal" id="pen'+i+'" min="0" max="20" step="0.5" value="6.5"></div></div>'+
  '<div class="pwrap" id="ep'+i+'"><label class="lbl" for="xp'+i+'">נקודות זיכוי נוספות</label><input type="number" inputmode="decimal" id="xp'+i+'" min="0" step="0.25" value="0"></div></div>'+
  '<label class="check" id="sw'+i+'"><input type="checkbox" id="st'+i+'"><span>יש קרן השתלמות (2.5% עובד ו-7.5% מעסיק, עד התקרה)</span></label>'+
  '</div></div>';
}).join('');

function finite(v){var x=parseFloat(v);return isFinite(x)?x:0;}
function readInputs(){
  var num=function(id){return Math.max(0,finite(document.getElementById(id).value));};
  var checked=function(n){var e=document.querySelector('input[name="'+n+'"]:checked');return e?e.value:'';};
  var couple=checked('status')==='couple';
  var adults=[0,1].map(function(i){return{gender:checked('g'+i),mode:checked('m'+i),salary:num('sal'+i),pension:Math.min(20,num('pen'+i)),extraPts:num('xp'+i),study:document.getElementById('st'+i).checked};});
  return{couple:couple,kids:state.kids,extra:state.extra,adults:adults,
    autoChild:$('#autoChild').checked,childManual:num('childManual'),allowances:num('allow'),pensionIncome:num('pens'),capital:num('cap'),other:num('oth'),
    adjPct:Math.max(-99,Math.min(MAX_PCT,finite($('#adj').value))),deductPension:$('#deductPension').checked};
}

function render(){
  var inp=readInputs(),r=calcHousehold(inp);
  $('#kidsTotal').textContent=r.kidsTotal;
  $('#childAuto').textContent=fmt(childAllowance(r.kidsTotal));
  $('#childManualWrap').hidden=inp.autoChild;
  $('#adult1').hidden=!inp.couple;
  $('#adult0 .aname').textContent=inp.couple?ADULT_NAMES[0]:'הכנסה מעבודה';
  [0,1].forEach(function(i){var net=inp.adults[i].mode==='net';$('#pw'+i).hidden=net;$('#ep'+i).hidden=net;$('#sw'+i).hidden=net;});

  $('#dec').textContent=r.decile;
  $('#pcOut').textContent='₪'+fmt(r.pc);
  $('#barDec').textContent=r.decile;
  $('#barPc').textContent='₪'+fmt(r.pc);

  $('#ladder').innerHTML=r.thr.concat([r.thr[8]]).map(function(t,i){
    var lab=i<9?(t/1000).toFixed(1):'>'+(t/1000).toFixed(1);
    return '<div class="cell'+(r.decile===i+1?' on':'')+'"><b>'+(i+1)+'</b><i>'+lab+'</i></div>';
  }).join('');

  var g='';
  if(r.decile<10){var up=(r.thr[r.decile-1]-r.pc)*r.std;g='תוספת של כ-<b>₪'+fmt(up)+'</b> נטו בחודש למשק הבית מעבירה לעשירון '+(r.decile+1)+'.';}
  else{g='משק הבית מעל הגבול של עשירון 9 (₪'+fmt(r.thr[8])+' לנפש תקנית).';}
  if(r.decile>1){var dn=(r.pc-r.thr[r.decile-2])*r.std;g+=' ירידה של כ-₪'+fmt(dn)+' בחודש מורידה לעשירון '+(r.decile-1)+'.';}
  $('#gapTxt').innerHTML=g;

  var n=inp.couple?2:1,P=r.people;
  var head='<tr><th></th>'+P.slice(0,n).map(function(_,i){return '<th class="v">'+(n===2?(i?'ב':'א'):'שכר')+'</th>';}).join('')+(n===2?'<th class="v">סה״כ</th>':'')+'</tr>';
  var line=function(label,key,sign){
    var cells=P.slice(0,n).map(function(p){return p.netMode&&key!=='net'?'<td class="v">–</td>':'<td class="v">'+sign+fmt(p[key])+'</td>';}).join('');
    var sum=0;P.slice(0,n).forEach(function(p){sum+=p[key]||0;});
    return '<tr><td>'+label+'</td>'+cells+(n===2?'<td class="v">'+sign+fmt(sum)+'</td>':'')+'</tr>';
  };
  var cols=n+(n===2?1:0);
  var pts='<tr><td>נקודות זיכוי</td>'+P.slice(0,n).map(function(p){return '<td class="v">'+(p.points===null?'–':p.points.toFixed(2).replace(/\.?0+$/,''))+'</td>';}).join('')+(n===2?'<td class="v"></td>':'')+'</tr>';
  var kv=function(label,val,cls){return '<tr'+(cls?' class="'+cls+'"':'')+'><td>'+label+'</td><td class="v" colspan="'+cols+'">'+val+'</td></tr>';};
  var rows=head+line('שכר ברוטו','gross','')+line('מס הכנסה','tax','−')+line('ביטוח לאומי','ni','−')+line('ביטוח בריאות','health','−')+pts+line('שכר נטו','net','');
  if(inp.deductPension){
    rows+=kv('הפרשת עובד לפנסיה','−'+fmt(r.pensionSum));
    if(r.studySum>0)rows+=kv('הפרשת עובד לקרן השתלמות','−'+fmt(r.studySum));
  }
  rows+=kv('קצבאות והכנסות נוספות','+'+fmt(r.other));
  rows+=kv('הכנסה נטו למשק הבית','₪'+fmt(r.total),'tot');
  rows+=kv('נפשות בבית',r.persons)+kv('נפשות תקניות',r.std.toFixed(2).replace(/\.?0+$/,''))+kv('נטו לנפש תקנית','₪'+fmt(r.pc),'tot');
  $('#tbl').innerHTML=rows;
}

$('#scale').innerHTML='<tr><th>נפשות בבית</th>'+[1,2,3,4,5,6,7,8].map(function(i){return '<th class="v">'+i+'</th>';}).join('')+'<th class="v">9+</th></tr>'+
  '<tr><td>נפשות תקניות</td>'+[1,2,3,4,5,6,7,8].map(function(i){return '<td class="v">'+SCALE[i]+'</td>';}).join('')+'<td class="v">+0.4 לכל נפש</td></tr>';

document.addEventListener('click',function(e){
  var b=e.target.closest('.stepper button');if(!b)return;
  var s=b.closest('.stepper'),id=s.getAttribute('data-step'),dir=parseInt(b.getAttribute('data-dir'),10);
  if(id==='extra'){state.extra=Math.max(0,Math.min(10,state.extra+dir));s.querySelector('output').textContent=state.extra;}
  else if(Object.prototype.hasOwnProperty.call(state.kids,id)){state.kids[id]=Math.max(0,Math.min(12,state.kids[id]+dir));s.querySelector('output').textContent=state.kids[id];}
  render();
});
document.addEventListener('input',render);
document.addEventListener('change',render);
render();
})();
