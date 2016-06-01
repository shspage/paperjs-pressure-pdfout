/* 
generatePdfFromPaperJs v0.121
generates PDF data from PaperScope object (paper) of Paper.js.

required library: paper.js

Author: Hiroyuki Sato
https://github.com/shspage

Date: Sun, 20 Jan 2013 20:17:38 +0900
---------------------------------------------------------------

Paper.js - a JavaScript Vector Graphics Library.
Copyright (c) 2011, Juerg Lehni & Jonathan Puckey
http://paperjs.org/
Distributed under the MIT license.
*/

/*
HTML code example:
<head>...
<script type="text/javascript" src="../../lib/paper.js"></script>
<script type="text/javascript" src="../../lib/generatePdfFromPaperJs-0.12a.js"></script>
<script type="text/paperscript" canvas="canvas"...
...
<body>
<div style="z-index:0; top:20px; position:absolute">
<canvas id="canvas" resize></canvas>
</div>
<div style="z-index:1; position:absolute;margin-left:10px">
	[<a href="#" onclick="generatePdfFromPaperJs('canvas', document.form1, document.form1.svg_txt)">generate svg</a>]
	<form name="form1" style="display:none">
	<textarea name="svg_txt" rows="10" cols="60"></textarea>
	</form>
</div>
...
*/

function generatePdfFromPaperJs(canvas_name, target_form, target_textarea){
    var stream_length = 0;
    var H = 0;
  
    function f2i(f){
        return f.toFixed();
    }
    function f2s(f){
        return f.toFixed(4).replace(/0+$/,"").replace(/\.$/,"");
    }
    // ---------------------------------------------------------------
    function hsv2rgb(h, s, v){
        // http://ja.wikipedia.org/wiki/HSV%E8%89%B2%E7%A9%BA%E9%96%93#HSV.E3.81.8B.E3.82.89RGB.E3.81.B8.E3.81.AE.E5.A4.89.E6.8F.9B
        // experimental
        var r,g,b;
        if(s == 0){
            r = v; g = v; b = v;
        } else {
            var hi = parseInt(h / 60);
            var f = h / 60 - hi;
            var p = v * (1 - s);
            var q = v * (1 - f * s);
            var t = v * (1 - (1 - f) * s);
            if(hi == 0){ r = v; g = t; b = p;
            } else if(hi == 1){ r = q; g = v; b = p;
            } else if(hi == 2){ r = p; g = v; b = t;
            } else if(hi == 3){ r = p; g = q; b = v;
            } else if(hi == 4){ r = t; g = p; b = v;
            } else { r = v; g = p; b = q; }
        }
        return [f2s(r), f2s(g), f2s(b)].join(" ");
    }
    // ---------------------------------------------------------------
    function hsl2rgb(h, s, l){
        // http://en.wikipedia.org/wiki/HSL_and_HSV#From_HSL
        // experimental
        var r,g,b;
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var hd = h / 60;
        var x = c * (1 - Math.abs((hd % 2) - 1));
        if(hd >= 0){
            if(hd < 1){ r = c; g = x; b = 0;
            } else if(hd < 2){ r = x; g = c; b = 0;
            } else if(hd < 3){ r = 0; g = c; b = x;
            } else if(hd < 4){ r = 0; g = x; b = c;
            } else if(hd < 5){ r = x; g = 0; b = c;
            } else if(hd < 6){ r = c; g = 0; b = x; }
        } else {
            r = 0; g = 0; b = 0;
        }
        var m = l - c / 2;
        return [f2s((r+m)), f2s((g+m)), f2s((b+m))].join(" ");
    }
    // ---------------------------------------------------------------
    function attr_color(color, attr){
        var s = "";
        if(color instanceof paper.RgbColor){
            // TODO: rgba
            s += [f2s(color.red ), f2s(color.green ),
                  f2s(color.blue )].join(" ")
              + (attr == "fill" ? " rg" : " RG");
         } else if(color instanceof paper.GrayColor){
             s += f2s(color.gray )
               + (attr == "fill" ? " g" : " G");
         } else if(color instanceof paper.HslColor){
             // TODO: hsla
             s += hsl2rgb(color.hue, color.saturation, color.lightness)
               + (attr == "fill" ? " rg" : " RG");
         } else if(color instanceof paper.HsbColor){
             s += hsv2rgb(color.hue, color.saturation, color.brightness)
               + (attr == "fill" ? " rg" : " RG");
         } else if(color instanceof paper.GradientColor){
             // not supported yet
             s += "0 " + (attr == "fill" ? " g" : " G");
         }
         if(s != ""){
            stream_length += s.length + 2;
            s += "\r\n";
         }
         return s;
    }
    // ---------------------------------------------------------------
    function attr_dash(dashArray){
        var s = "";
        if(dashArray.length > 0){
            var r = [];
            for(var j = 0; j < dashArray.length; j++){
                r.push(f2s(dashArray[j]));
            }
            s += "[" + r.join(" ") + "] 0 d";
        }
         if(s != ""){
            stream_length += s.length + 2;
            s += "\r\n";
         }
        return s;
    }
    // ---------------------------------------------------------------
    var dict_attr_stroke_cap_and_join = {
        "butt":0, "round":1, "project":2,
        "miter":0, "bevel":2
    };
    function attr_stroke_cap_and_join(stroke){
        // adds attributes only when they differ from the default values
        var s = "", tmp_s;
        if(stroke.strokeCap != "butt"){
            tmp_s = dict_attr_stroke_cap_and_join[stroke.strokeCap] + " J";
            stream_length += tmp_s.length + 2;
            s += tmp_s + "\r\n";
        }
        if(stroke.strokeJoin != "miter"){
            tmp_s = dict_attr_stroke_cap_and_join[stroke.strokeJoin] + " j";
            stream_length += tmp_s.length + 2;
            s += tmp_s + "\r\n";
        }
        if(stroke.miterLimit != 4){
            tmp_s = f2i(stroke.miterLimit) + " M";
            stream_length += tmp_s.length + 2;
            s += tmp_s + "\r\n";
        }
        return s;
    }
    // ---------------------------------------------------------------
    function attr_bezier(seg1, seg2){
        var s;
        if(seg1.handleOut.isZero() && seg2.handleIn.isZero()){
            s = f2s(seg2.point.x) + " " + f2s(H - seg2.point.y) + " l";
        } else if(seg1.handleOut.isZero()){
            s = f2s(seg2.handleIn.x + seg2.point.x)  + " "
              + f2s(H - (seg2.handleIn.y + seg2.point.y))  + " "
              + f2s(seg2.point.x) + " " + f2s(H - seg2.point.y) + " v";
        } else if(seg2.handleIn.isZero()){
            s = f2s(seg1.handleOut.x + seg1.point.x) + " "
              + f2s(H - (seg1.handleOut.y + seg1.point.y)) + " "
              + f2s(seg2.point.x) + " " + f2s(H - seg2.point.y) + " y";
        } else {
            s = f2s(seg1.handleOut.x + seg1.point.x) + " "
              + f2s(H - (seg1.handleOut.y + seg1.point.y)) + " "
              + f2s(seg2.handleIn.x + seg2.point.x)  + " "
              + f2s(H - (seg2.handleIn.y + seg2.point.y))  + " "
              + f2s(seg2.point.x) + " " + f2s(H - seg2.point.y) + " c";
        }
        stream_length += s.length + 2;
        return s + "\r\n";
    }
    // ---------------------------------------------------------------
    function attr_d_of_tag_path(c, opt){
        var s = "";
        if(c.segments.length > 1){
            var seg = c.segments[0];
            s += f2s(seg.point.x) + " " + f2s(H - seg.point.y) + " m";
            stream_length += s.length + 2;
            s += "\r\n";
            
            var idx;
            for(var j=0; j < c.segments.length; j++){
                if(j == c.segments.length - 1){
                    if(c.closed){
                        idx = 0;
                    } else {
                        break;
                    }
                } else {
                    idx = j + 1;
                }
                s += attr_bezier(c.segments[j], c.segments[idx]);
            }
            if(c.closed){
                opt.closed = true;
            }
        }
        return s;
    }
    
    // ---------------------------------------------------------------
    function pre_attrs_of_tag_path(c, opt){
        var s_fill = "", s_stroke = "", tmp_s;
        var s = "q\r\n";
        stream_length += 3;
               
        // fill
        s_fill = attr_color(c.fillColor, "fill");
        if(s_fill != "") opt.filled = true;
        
        // stroke
        if(c.strokeWidth > 0){
            s_stroke = attr_color(c.strokeColor, "stroke");
            if(s_stroke != ""){
                tmp_s = f2s(c.strokeWidth) + " w";
                stream_length += tmp_s.length + 2;
                s_stroke += tmp_s + "\r\n";
                
                s_stroke += attr_stroke_cap_and_join(c);
                s_stroke += attr_dash(c.dashArray);
                opt.stroked = true;
            }
        }
        
        return s + s_fill + s_stroke;
    }
    // ---------------------------------------------------------------
    function post_attrs_of_tag_path(c, opt){
        var s = "";
        if(opt.compound){
            if(opt.stroked){
                s += opt.closed ? "b*" : "B*";
            } else {
                s += "f*";
            }
        } else {
            if(opt.filled && opt.stroked){
                s += opt.closed ? "b" : "B";
            } else if(opt.filled){
                s += "f";
            } else {
                s += opt.closed ? "s" : "S";
            }
        }
        
        opt.filled = false;
        opt.stroked = false;
        opt.closed = false;
        opt.compound = false;
        
        stream_length += s.length + 5;
        return s + "\r\nQ\r\n";
    }
    // ---------------------------------------------------------------
    function attr_group(grp, layer_id){
        // not supported yet
        return "";
    }
    // ---------------------------------------------------------------
    function add_tags(c){
        var s = "", r, tmp_s;
        //var sym_def, sym_pos, sym_sb, mtx; // for PlacedSymbol
        var opt = { filled:false, stroked:false, closed:false,
            compound:false };

        if( ! c.visible ){
            // do nothing
        } else if(c instanceof paper.Path){
            if(c.segments.length > 1){
                tmp_s = attr_d_of_tag_path(c, opt);
                if(tmp_s != ""){
                    s += pre_attrs_of_tag_path(c, opt);
                    s += tmp_s;
                    s += post_attrs_of_tag_path(c, opt);
                }
            }
        } else if(c instanceof paper.CompoundPath){
            // not tested yet
            r = [];
            for(var i=0; i < c.children.length; i++){
                r.push(attr_d_of_tag_path(c.children[i]), opt);
            }
            if(r.length > 0){
                // there's at least 1 path that has 2 or more segments
                s += pre_attrs_of_tag_path(c, opt);
                s += r.join("");
                s += post_attrs_of_tag_path(c, opt);
            }
        } else if(c instanceof paper.PlacedSymbol){
            // not supported yet
        } else if(c instanceof paper.Group){
            // group attributes is ignored
            for(var i=0; i < c.children.length; i++){
                s += add_tags(c.children[i]);
            }
        } else if(c instanceof paper.TextItem){
            // not supported yet
        } else if(c instanceof paper.Raster){
            // not supported yet
        }
        return s;
    }
    
    // ---------------------------------------------------------------
    function  getCreationDate(){
        var s = "";
        var date = new Date();
        s += date.getFullYear();
        var m = (date.getMonth() + 1).toString();
        if( m.length == 1 ) m = "0" + m;
        s += m;
        var d = date.getDate();
        if( d.length == 1 ) d = "0" + d;
        s += d;
        return s;
    }

    // ---------------------------------------------------------------
    function zerofill(n){
        var s = n.toString();
        while(s.length < 10) s = "0" + s;
        return s;
    }
    
    // ---------------------------------------------------------------
    // main
    // ---------------------------------------------------------------
    if(target_form.style.display != "none"){
        target_form.style.display = "none";
        return;
    }
    target_form.style.display = "block";
    
    var canvas = document.getElementById(canvas_name);
    var canv_w = f2s(canvas.width);
    H = canvas.height;
    var canv_h = f2s(canvas.height);
    
    var s = "%PDF-1.3\r\n"
    + "% !!!IMPORTANT!!! save with return code CRLF\r\n"
    + "1 0 obj\r\n"
    + "<< /Type /Page /Parent 4 0 R /Resources 3 0 R /Contents 2 0 R >>\r\nendobj\r\n"
    + "2 0 obj\r\n";
    
    var stream = "";
    //for(var i = 0; i < paper.project.layers.length; i++){
        //var lay = paper.project.layers[i];
        var lay = paper.project.layers[paper.project.layers.length - 1];
        // output only last layer for now
        
        for(var j = 0; j < lay.children.length; j++){
            stream += add_tags(lay.children[j]);
        }
    //}
    
    var real_stream_length = stream != "" ? stream_length - 2 : 0;
    
    s += "<< /Length " + real_stream_length + " >>\r\n" 
    + "stream\r\n";
    s += stream;
    s += "endstream\r\n"
    + "endobj\r\n"
    + "3 0 obj\r\n"
    + "<< /ProcSet [ /PDF ] >>\r\nendobj\r\n"
    + "4 0 obj\r\n"
    + "<< /Type /Pages /Kids [ 1 0 R ] /Count 1 /MediaBox [0 0 "
    + canv_w + " " + canv_h + "] >>\r\nendobj\r\n"
    + "5 0 obj\r\n"
    + "<< /Type /Catalog /Pages 4 0 R >>\r\nendobj\r\n"
    + "6 0 obj\r\n";
    
    s += "<< /CreationDate (D:" + getCreationDate() + ")\r\n";
    
    s += "/Title (untitled)\r\n"
    + "/Author (someone)\r\n"
    + ">>\r\nendobj\r\n"
    + "xref\r\n"
    + "0 7\r\n"
    + "0000000000 65535 f\r\n"
    + "0000000056 00000 n\r\n"
    + "0000000139 00000 n\r\n";
    
    var offset = real_stream_length.toString().length;
    
    s += zerofill(stream_length + 191 + offset) + " 00000 n\r\n";
    s += zerofill(stream_length + 233 + offset) + " 00000 n\r\n";
    
    offset += canv_w.length + canv_h.length;
    
    s += zerofill(stream_length + 313 + offset) + " 00000 n\r\n"
    + zerofill(stream_length + 365 + offset) + " 00000 n\r\n";
    
    s += "trailer\r\n"
    + "<<\r\n"
    + "/Root 5 0 R\r\n"
    + "/Info 6 0 R\r\n"
    + "/Size 7\r\n"
    + ">>\r\n"
    + "startxref\r\n";
    
    s += (stream_length + 455 + offset).toString() + "\r\n";
    s += "%%EOF\r\n";
    
    target_textarea.value = s;
}
