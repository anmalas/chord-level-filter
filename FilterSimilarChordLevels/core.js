//==============================================================================
// Filter Similar Note Levels v1.0
// https://github.com/Ash-86/Filter-Similar-Note-Levels
//
//  Copyright (C)2023 Ashraf El Droubi (Ash-86)
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//===============================================================================


/**
* @param counting "up"|"down" Counting notes up (from bottom) or down (from top)            
* @param strictCounting true|false(default, original mode) In strict mode, selecting notes 1,3 from 2-notes chord, only the 1st note of that chord will be selected. In non strict mode, the notes 1,2 will be selected
* @param expandToFullScore "score"|"measure"
*/
function makeSelection(counting, strictCounting, defaultExpand) {    
    
    var fullScore= false    

    /// MuseScore 4.7 no longer guarantees el.notes is ordered low->high by pitch.
    /// This returns the chord's note objects sorted by pitch ascending so that
    /// index 0 is always the lowest pitch, matching how "level" is computed.
    function sortedNotes(chord){
        var arr=[]
        for (var k in chord.notes){
            arr.push(chord.notes[k])
        }
        arr.sort(function(a,b){return a.pitch-b.pitch})
        return arr
    }

    var cursor = curScore.newCursor();               
    var els = curScore.selection.elements 

    
    var note=[]
    var Notes=[]

    for (var i in els){
        var track = els[i].track
        var staff = ~~(track/4)  
        var voice = track%4        
        /// In 4.7 the element parent chain / tick exposure changed. Prefer the
        /// segment tick via the chord's parent, but fall back gracefully.
        var chord = els[i].parent
        var tick
        if (chord && chord.parent && chord.parent.tick !== undefined) {
            tick = chord.parent.tick           /// note -> chord -> segment.tick
        } else if (chord && chord.tick !== undefined) {
            tick = chord.tick                  /// chord.tick directly
        } else {
            tick = els[i].parent.parent.tick   /// original behaviour
        }

        var pitch=els[i].pitch
        
        console.log("els["+i+"]: "+els[i].userName());

        /// MuseScore 4.7 no longer guarantees chord.notes is sorted by pitch
        /// (low->high). Build an explicit pitch-sorted list so "level" is stable
        /// across versions. sortedPitches[0] is always the lowest pitch.
        var sortedPitches=[]
        for (var n in chord.notes){
            sortedPitches.push(chord.notes[n].pitch)
        }
        sortedPitches.sort(function(a,b){return a-b})

        var pitchIndex=-1
        for (var p in sortedPitches){
            if (sortedPitches[p]==pitch){
                pitchIndex=~~p   /// index in low->high order
            }
        }

        var level
        if (counting=="up") {level = pitchIndex}
        if (counting=="down") {level = sortedPitches.length-1-pitchIndex}
        if (!strictCounting && (level==sortedPitches.length-1)) {
            level=100  /// special number for bottom or top notes -depending on counting direction
        }
        note = {staff:staff, voice:voice, track:track, level:level, tick:tick}  
        Notes.push(note)       
    }       

    
    var tracks=[]  ///get unique tracks of selected notes
    var staves=[]   //get unique staves of selected notes
    var ticks=[]     //get unique ticks of selected notes
    for (var i in Notes){
        if(!tracks.some(function(x){return x==Notes[i].track})){
            tracks.push(Notes[i].track)
        }       
        if(!staves.some(function(x){return x==Notes[i].staff})){
            staves.push(Notes[i].staff)
        }                       
        if(!ticks.some(function(x){return x==Notes[i].tick})){                          
            ticks.push(Notes[i].tick)
        }
    }
       staves.sort(function(a,b){return a-b})
       tracks.sort(function(a,b){return a-b})
       ticks.sort(function(a,b){return a-b})

    
    var voices=[];  ///get unique voices per staff        
    for (var i in staves){
        var voic=[]            
        for (var n in Notes){                
            if(Notes[n].staff==staves[i]){                    
                if (!voic.some(function(x){return x==Notes[n].voice})){ 
                    voic.push(Notes[n].voice) 
                }
            }
        }            
        voic.sort();           
        voices.push(voic)
    }
    
    var levels=[] //get unique levels per track
    for (var i in tracks){
        var lev=[]
        for (var n in Notes){
            if(Notes[n].track==tracks[i]){
                if (!lev.some(function(x){return x==Notes[n].level})){                            
                    lev.push(Notes[n].level)
                }
            }
        } 
        lev.sort(function(a,b){return a-b})         
        levels.push(lev)
    }


    console.log("staves : ", staves,"voices : ", voices[0],voices[1], "tracks : ",tracks,"levels : " ,levels[0],levels[1], levels[2]  )

   
    ///////////////////////////////////////////////////////
        var t1 = ticks[0];  // min tick
        var t2 = ticks[ticks.length-1]; //max tick 

    cursor.track=tracks[0]
    cursor.rewindToTick(t2)
    cursor.next()
    if (cursor.tick==0){  //check if end of track or staff
        cursor.rewindToTick(t2)
        var endOfMeasureTick=cursor.measure.lastSegment.tick
        var endOfStaffTick= curScore.lastSegment.tick
        if (endOfMeasureTick==endOfStaffTick){
            var t2=curScore.lastSegment.tick+1 
        }
        else{
            t2= cursor.measure.lastSegment.tick  //in case of end of voice but not staff
        }             
    }
    else{
        t2=cursor.tick      /////fix t2 to go till (end of last selected note)/(start of next note)
    }


    /////////////////////////////  check if plugin has run once, if so, extends ticks to cover full score. 
    for (var i in tracks){   
        cursor.track=tracks[i]
        cursor.rewindToTick(t1)
        cursor.next()
        for (var n in Notes){
            if (Notes[n].track==tracks[i]){  //check if note belongs to current track
                if (Notes[n].tick==cursor.tick){ // check it the nots's tick is adjacent to first 
                    console.log("2nd call of the plugin, switching to fullscore mode");
                    fullScore=true
                }                    
            }                
        }
    }////not the best way to make sure the plugin has already run. Perhaps one can get the last entry in history and check if plugin had already run once. 


    if (ticks.length==1) {   //// if notes selected belong to same chord or segment or only one note selected, make t1 and t2 start and end ticks of measure    
        if(defaultExpand==="measure") {
            console.log("Single chord selection, extending to measure");
            cursor.rewindToTick(t1)                      
            t1= cursor.measure.firstSegment.tick
            t2= cursor.measure.lastSegment.tick
        } else {
            console.log("Single chord selection, extending to score");
            fullScore=true;
        }
    }
    
   
    if(fullScore){
        console.log("fullScore mode");
        var t1=curScore.firstMeasure.firstSegment.tick  /// first tick in score
        var t2=curScore.lastSegment.tick+1                //// last tick in score
    }

    console.log("t1= ",t1, "t2= ",t2)       


    var copy=true            
    for (var i=1; i<staves.length;i++){    //// check if selection are in consecutive staves in order to copy. 
        if ((staves[i]-staves[i-1]) >1){
            var copy=false
        }            
    }

    /////////////////////////////////////////////////////////
    /// Non-destructive selection only.
    ///
    /// The original plugin temporarily deleted the non-matching notes, ran
    /// cmd("copy"), then cmd("undo") to restore them. In MuseScore 4.7 a
    /// plugin window holds focus with UI context UiCtxUnknown, so cmd()
    /// actions (including "undo" and "copy") silently do nothing. That left
    /// the temporary deletions permanently applied to the score.
    ///
    /// Since the goal is only to *select* every note matching the chosen
    /// level/voice condition, we skip the whole delete/copy/undo dance and
    /// just build the selection directly. This never modifies the score, so
    /// it is robust across versions. (The `copy` flag is kept for reference
    /// but no longer drives a destructive branch.)
    for (var i in tracks){                
        cursor.track=tracks[i]
        cursor.rewindToTick(t1)
        if (cursor.element){
            while (cursor.segment && (cursor.tick < t2)) {   /// selects notes with same levels on the same track
                var el= cursor.element
                if(el.type == Element.CHORD) {                    
                    var sn= sortedNotes(el)   /// low->high by pitch
                    for (var n=0; n<sn.length; n++) { 
                        if (levels[i].some(function(x){return x==n})){                           
                            if (counting=="up") {curScore.selection.select(sn[n], true)}  
                            if (counting=="down") {curScore.selection.select(sn[sn.length-1-n], true)}  
                        }
                    }
                    if (levels[i].some(function(x){return x==100})){   /// check top or bottom note 
                        if (counting=="down") {curScore.selection.select(sn[0], true)}
                        if (counting=="up") { curScore.selection.select(sn[sn.length-1], true)}
                    }                           
                }
                cursor.next()   
            }
        }
    }
}