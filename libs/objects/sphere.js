/**
 * sphere.js
 * 
 */ 

export { init, draw };

import { vec3, normalize, flatten } from '../MV.js';

const points = [];
const normals = [];
const faces = [];
const edges = [];

var points_buffer;
var normals_buffer;
var faces_buffer;
var edges_buffer;

var SPHERE_LATS=20;
var SPHERE_LONS=30;

function init(gl) {
    _build(SPHERE_LATS, SPHERE_LONS);
    _uploadData(gl);
}

// Generate points using polar coordinates
function _build(nlat, nlon) 
{
    // phi will be latitude
    // theta will be longitude
 
    var d_phi = Math.PI / (nlat+1);
    var d_theta = 2*Math.PI / nlon;
    var r = 0.5;
    
    // Genreate the points

    // Generate north polar cap points and normals
    var north = vec3(0,r,0);
    points.push(north);
    normals.push(vec3(0,1,0));
    
    // Generate middle points and normals
    for(var i=0, phi=Math.PI/2-d_phi; i<nlat; i++, phi-=d_phi) {
        for(var j=0, theta=0; j<nlon; j++, theta+=d_theta) {
            var pt = vec3(r*Math.cos(phi)*Math.cos(theta),r*Math.sin(phi),r*Math.cos(phi)*Math.sin(theta));
            points.push(pt);
            var n = vec3(pt);
            normals.push(normalize(n));
        }
    }
    
    // Generate south polar cap points and normals
    var south = vec3(0,-r,0);
    points.push(south);
    normals.push(vec3(0,-1,0));
    
    // Generate the faces
    
    // north pole faces
    for(var i=0; i<nlon-1; i++) {
        faces.push(0);
        faces.push(i+1);
        faces.push(i+2);
    }
    faces.push(0);
    faces.push(nlon);
    faces.push(1);
    
    // general middle faces
    var offset=1;
    
    for(var i=0; i<nlat-1; i++) {
        for(var j=0; j<nlon-1; j++) {
            var p = offset+i*nlon+j;
            faces.push(p);
            faces.push(p+nlon);
            faces.push(p+nlon+1);
            
            faces.push(p);
            faces.push(p+nlon+1);
            faces.push(p+1);
        }
        var p = offset+i*nlon+nlon-1;
        faces.push(p);
        faces.push(p+nlon);
        faces.push(p+1);

        faces.push(p);
        faces.push(p+1);
        faces.push(p-nlon+1);
    }
    
    // south pole faces
    var offset = 1 + (nlat-1) * nlon;
    for(var j=0; j<nlon-1; j++) {
        faces.push(offset+nlon);
        faces.push(offset+j+1);
        faces.push(offset+j);
    }
    faces.push(offset+nlon);
    faces.push(offset);
    faces.push(offset+nlon-1);
 
    // Build the edges
    for(var i=0; i<nlon; i++) {
        edges.push(0);   // North pole 
        edges.push(i+1);
    }

    for(var i=0; i<nlat; i++, p++) {
        for(var j=0; j<nlon;j++, p++) {
            var p = 1 + i*nlon + j;
            edges.push(p);   // horizontal line (same latitude)
            if(j!=nlon-1) 
                edges.push(p+1);
            else edges.push(p+1-nlon);
            
            if(i!=nlat-1) {
                edges.push(p);   // vertical line (same longitude)
                edges.push(p+nlon);
            }
            else {
                edges.push(p);
                edges.push(points.length-1);
            }
        }
    }
    
}

function _uploadData(gl)
{
    points_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, points_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    
    normals_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normals_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    
    faces_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faces_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(faces), gl.STATIC_DRAW);
    
    edges_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edges_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edges), gl.STATIC_DRAW);
}

function draw(gl, program, primitive)
{    
    gl.useProgram(program);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, points_buffer);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, normals_buffer);
    var vNormal = gl.getAttribLocation(program, "vNormal");
    if( vNormal != -1 ) {
        gl.enableVertexAttribArray(vNormal);
        gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    }
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive == gl.LINES ? edges_buffer : faces_buffer);
    gl.drawElements(primitive, primitive == gl.LINES ? edges.length : faces.length , gl.UNSIGNED_SHORT, 0);
}