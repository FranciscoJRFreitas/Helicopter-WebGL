/**
 * bunny.js
 * 
 */ 
 export {
    init, draw
}

import { vec3, flatten, add, subtract, normalize } from '../MV.js';

import { points, faces } from './bunny-data.js';

var points_buffer;
var normals_buffer;
var faces_buffer;
var edges_buffer;

var edges = [];
var normals = [];

function init(gl) {
    _build();
    _uploadData(gl);
}

function _build(){

    for(var i = 0; i<points.length; i+=3){
        //center the rabbit
        points[i+1] -= 0.1;
        pointNormals[i/3] = vec3(0,0,0);
    }

    for(var i = 0; i<faces.length; i+=3){
        _calcFaceNormal(faces[i], faces[i+1], faces[i+2]);
        _addEdge(faces[i+0], faces[i+1]);
        _addEdge(faces[i+1], faces[i+2]);
        _addEdge(faces[i+2], faces[i+0]);
    }

    for(var i = 0; i<points.length/3;i++){
        normals.push(normalize(pointNormals[i]));
    }
}

var pointNormals = {};
function _calcFaceNormal(i1, i2, i3){
    var p1 = vec3(points[i1*3], points[i1*3+1], points[i1*3+2]);
    var p2 = vec3(points[i2*3], points[i2*3+1], points[i2*3+2]);
    var p3 = vec3(points[i3*3], points[i3*3+1], points[i3*3+2]);
    var u = subtract(p2, p1);
    var v = subtract(p3, p1);

    var normal = vec3(
        u[1]*v[2] - u[2]*v[1],
        u[2]*v[0] - u[0]*v[2],
        u[0]*v[1] - u[1]*v[0]
    )
    pointNormals[i1] = add(pointNormals[i1], normal);
    pointNormals[i2] = add(pointNormals[i2], normal);
    pointNormals[i3] = add(pointNormals[i3], normal);
}

var existingEdges = {};
function _addEdge(i1, i2){
    if(i1 > i2){
        var aux = i2;
        i2 = i1;
        i1 = aux;
    }
    if(!(existingEdges[i1] && existingEdges[i1][i2])){
        edges.push(i1);
        edges.push(i2);
        if (!existingEdges[i1]) existingEdges[i1] = {};
        existingEdges[i1][i2] = true;
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
    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, normals_buffer);
    const vNormal = gl.getAttribLocation(program, "vNormal");
    if(vNormal != -1) {
        gl.enableVertexAttribArray(vNormal);
        gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    }
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive == gl.LINES ? edges_buffer : faces_buffer);
    gl.drawElements(primitive, primitive == gl.LINES ? edges.length : faces.length, gl.UNSIGNED_SHORT, 0);
}