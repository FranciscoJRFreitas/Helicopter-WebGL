import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "./libs/utils.js";
import { ortho, lookAt, flatten, vec3, vec4, rotateX, rotateY, mult, inverse} from "./libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, multTranslation, popMatrix, pushMatrix, multRotationX, multRotationZ} from "./libs/stack.js";

import * as SPHERE from './libs/objects/sphere.js';
import * as CUBE from './libs/objects/cube.js';
import * as CYLINDER from './libs/objects/cylinder.js';
import * as PYRAMID from './libs/objects/pyramid.js';
import * as BUNNY from './libs/objects/bunny.js';
import * as TORUS from './libs/objects/torus.js';
import { GUI } from './libs/dat.gui.module.js';

const VELOCITY_FACTOR = 1.0;
const BOX_MASS = 0.5;
const MAXIMUM_VELOCITY_LEVEL = 8;
const CEILING = 15;
const FLOOR = 0;
const SPEED = 0.005; // Speed (how many time units added to time on each render pass
const SECOND = 60 * SPEED; //Speed increments one time per second.
const WORLDSCALE = 0.024; //World Scale
const UNITSAWAYFROMCENTER = 4.0; // radius of helicopter s circular movement | CONSTANT VS VARIABLE

/** @type WebGLRenderingContext */
//Not supposed to change
let gl;
let time = 0;           // Global simulation time
let motorVelocity = 0;
let height = 0;
let s = WORLDSCALE;
let isMovingLeft = false;
let boxes = [];
let leaningAngle = 0;
let heliTime = 0;
let bladeTime = 0;
let mView = lookAt([1.0, 0.5, 1.0], [-5.0, -2.5, -5.0], [0,1,0]);
let heliView;
let posCamera;
let atCamera;
let mModel;
let thirdPerson = false;

const camera = new function(){
    this.Zoom = 100;
    this.Gama = 0;
    this.Theta = 0;
}

const worldOptions = new function(){
    this.Speed = SPEED;
    this.Mode = NaN;
    this.Ceiling = CEILING;
}

const heliOptions = new function(){
    this.Speed = VELOCITY_FACTOR;
    this.Scale = 1.0;
    this.Height = 0.01;
    this.MotorVelocity = motorVelocity;
    this.Radius = UNITSAWAYFROMCENTER;
    this.LeaningAngle = leaningAngle;
}

const boxOptions = new function(){
    this.Number = boxes.length;
    this.Mass = BOX_MASS;
    this.Scale = 1.0;
}

const resetCam = { 
    reset:function() {
        thirdPerson = false;
        camera.Gama = 0;
        camera.Theta = 0;
        mView = mult(lookAt([1.0, 0.5, 1.0], [-5.0, -2.5, -5.0], [0,1,0]), mult(rotateY(camera.Gama), rotateX(camera.Theta))); 
        camera.Zoom = 100;
    }
};

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-aspect, aspect, -1, 1,-5,5);

    const gui = new GUI();
    
    const camOptFolder = gui.addFolder('Camera Options');
    camOptFolder.add(camera, "Zoom", 50, 1000).name("Zoom (%)").listen();
    var gamaCam = camOptFolder.add(camera, "Gama", -180, 180).name("Gama (º)").listen();
    var thetaCam = camOptFolder.add(camera, "Theta", -180, 180).name("Theta (º)").listen();
    camOptFolder.add(resetCam, 'reset').name("Reset Values");
    camOptFolder.open();

    const worldOptFolder = gui.addFolder('World Options');
    var mode = worldOptFolder.add(worldOptions, "Mode", {Lines: "gl.LINES", Solid: "gl.TRIANGLES"}).setValue("gl.TRIANGLES");
    worldOptions.Mode = gl.TRIANGLES;
    worldOptFolder.add(worldOptions, "Speed", SPEED/3, SPEED * 10);
    worldOptFolder.add(worldOptions, "Ceiling", 5, 20);
    worldOptFolder.close();

    const heliOptFolder = gui.addFolder('Helicopter Options');
    var heliMVel = heliOptFolder.add(heliOptions, "MotorVelocity", motorVelocity).name("Motor Velocity");
    var heliHeight = heliOptFolder.add(heliOptions, "Height", height);
    var heliLeanAng = heliOptFolder.add(heliOptions, "LeaningAngle", leaningAngle).name("Leaning Angle");
    heliOptFolder.add(heliOptions, "Speed", VELOCITY_FACTOR/2, VELOCITY_FACTOR * 5);
    heliOptFolder.add(heliOptions, "Scale", 0.2, 3);
    heliOptFolder.add(heliOptions, "Radius", 3, 9).name("Trajectory Radius");
    heliOptFolder.close();

    const boxOptFolder = gui.addFolder('Supply Box Options');
    var nBoxes = boxOptFolder.add(boxOptions, "Number", boxes.length);
    boxOptFolder.add(boxOptions, "Mass", 0.25, 2.0);
    boxOptFolder.add(boxOptions, "Scale", 1.0, 3.0);
    boxOptFolder.close();

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    gamaCam.onChange( function(){
        thirdPerson = false;
        mView = mult(lookAt([1.0, 0.5, 1.0], [-5.0, -2.5, -5.0], [0,1,0]), mult(rotateY(camera.Gama), rotateX(camera.Theta)));
    });

    thetaCam.onChange( function(){
        thirdPerson = false;
        mView = mult(lookAt([1.0, 0.5, 1.0], [-5.0, -2.5, -5.0], [0,1,0]), mult(rotateY(camera.Gama), rotateX(camera.Theta)));
    });

    mode.onChange( function(){
        if(worldOptFolder.__controllers[0].object.Mode == 'gl.LINES')
            worldOptions.Mode = gl.LINES;
        else
            worldOptions.Mode = gl.TRIANGLES;
    });

    document.getElementById("axonometricView").onclick = function changeAxonometricView() {
        thirdPerson = false;
        mView = lookAt([1,1,1], [0,0.1,0], [0,1,0]);
    }

    document.getElementById("frontView").onclick = function changeFrontView() {
        thirdPerson = false;
        mView = lookAt([1, 0.5, 0], [0, 0.5, 0.0], [0,1,0]);
    }

    document.getElementById("topView").onclick = function changeTopView() {
        thirdPerson = false;
        mView = lookAt([0, 1.5, 0], [0, 0.5, 0.0], [0,0,-1]);
    }

    document.getElementById("rightSideView").onclick = function changeRightSideView() {
        thirdPerson = false;
        mView = lookAt([0, 0.5, 1], [0, 0.5, 0.0], [0,1,0]);
    }

    document.getElementById("thirdPersonView").onclick = function changeFirstPersonView() {
        thirdPerson = true;
        mProjection = ortho(-aspect, aspect, -1, 1, -20,40);
    }

    document.onkeydown = function(event) {
        switch(event.key) {
            case "ArrowUp":
                if(motorVelocity < MAXIMUM_VELOCITY_LEVEL) {
                    motorVelocity++;
                    heliMVel.setValue(motorVelocity);
                }
            break;
            case "ArrowDown":
                if(motorVelocity > 0) {
                    motorVelocity--;
                    heliMVel.setValue(motorVelocity);
                }
            break;
            case "ArrowLeft":
                isMovingLeft = true;
               break;
        }
    };
    document.onkeyup = function(event) {
        switch(event.key) {
            case "ArrowLeft":
                isMovingLeft = false;
            break;
            case " ":
                boxes.push({height: height, heliTime: heliTime, boxTime: 0, reachedGround: 1, reachGroundTime: 0, motorVelocity: motorVelocity, isMovingLeft: isMovingLeft}); //reachedGround: variable to make boxes stop at y = 0.
                nBoxes.setValue(boxes.length);
            break;
        }
    }

    gl.clearColor(0.0, 0.68, 0.93, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);
    BUNNY.init(gl);
    TORUS.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-aspect, aspect, -1, 1, -5, 5);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function DropBox()
    {
        let boxThrowMovement = 0;
        let radius = heliOptions.Radius - heliOptions.Radius/3.4;
        for(let b of boxes){
            boxThrowMovement = (b.reachGroundTime * b.motorVelocity)/3;
            b.boxTime += worldOptions.Speed;
            if(b.boxTime - worldOptions.Speed <= 5 * SECOND) {
                b.height = b.height - (0.05 + b.boxTime**2) * boxOptions.Mass;
                if(!b.isMovingLeft)
                    boxThrowMovement = radius;
                else{
                    if((b.reachGroundTime**2 * b.motorVelocity) <= (b.reachGroundTime * 2 * b.motorVelocity))
                        boxThrowMovement = radius + (b.reachGroundTime * 2 * b.motorVelocity) - (b.reachGroundTime**2 * b.motorVelocity); //Parabola effect
                }

                if(b.height <= 0.0) //If box reaches ground
                    b.reachedGround = 0;
                else
                    b.reachGroundTime += worldOptions.Speed; //reachGroundTime stops incrementing when it reaches the ground
                pushMatrix();
                    multRotationY((360 * b.heliTime)-45);
                    multTranslation([boxThrowMovement, b.height * b.reachedGround , radius]);
                    multRotationY(180 * b.reachGroundTime);
                    multScale([boxOptions.Scale,boxOptions.Scale, boxOptions.Scale]);
                    CargoBox();
                popMatrix();
            }
        else
            boxes.splice(boxes.indexOf(b),1);
        nBoxes.setValue(boxes.length);
        }
    }

    function Ground()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.3, 0.3)); //Grey Ground Color
        pushMatrix();
            multTranslation([-7.5, -0.025, 0.0]);
            multScale([35.0, 0.05 , 50.0]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.0, 0.6, 0.29)); //Grass Green Ground Color
        pushMatrix();
            multTranslation([17.5, -0.025, 0.0]);
            multScale([15.0, 0.05 , 50.0]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function Body()
    {   
        multTranslation([0.0, 0.4, 0.0]);
        multScale([0.9, 0.5, 0.5]);

        uploadModelView();
        SPHERE.draw(gl, program, worldOptions.Mode);
    }

    function Tail()
    {
        multTranslation([0.75, 0.5, 0.0]);
        multScale([0.9, 0.15, 0.15]);


        uploadModelView();
        SPHERE.draw(gl, program, worldOptions.Mode);
    }

    function TailFin()
    {
        multTranslation([1.2, 0.6, 0.0]);
        multRotationZ(60);
        multScale([0.3, 0.15, 0.15]);

        uploadModelView();
        SPHERE.draw(gl, program, worldOptions.Mode);
    }

    function Mast()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1.0, 1.0, 1.0)); //Mast color
        multTranslation([0.0, 0.68, 0.0]);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, worldOptions.Mode);
    }

    function TailMast()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1.0, 1.0, 1.0)); //Mast color
        multTranslation([1.2, 0.62, 0.1]);
        multRotationX(90);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, worldOptions.Mode);
    }

    function TailBlade()
    {
        multScale([0.4, 0.015, 0.02]);
        uploadModelView();
        SPHERE.draw(gl, program, worldOptions.Mode);
    }

    function TailBlades()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.0, 0.0, 0.0)); //TailBlades color
        pushMatrix();
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();
        pushMatrix();
            multRotationY(180);
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();

    }

    function landingSkid()
    {
        multScale([1, 0.03, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, worldOptions.Mode); 
    }

    function LandingSkids()
    {
        pushMatrix();
            multTranslation([0.0, 0.0, 0.2]);
            landingSkid();
        popMatrix();
        pushMatrix();
            multTranslation([0.0, 0.0, -0.2]);
            landingSkid();
        popMatrix();
    }

    function Connection()
    {
        multScale([0.3, 0.015, 0.02]);

        uploadModelView();
        CUBE.draw(gl, program, worldOptions.Mode);
    }
   
    function Connections()
    {
        pushMatrix();
            multTranslation([0.2, 0.1, 0.15]);
            multRotationX(-30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([0.2, 0.1, -0.15]);
            multRotationX(30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.1, 0.15]);
            multRotationX(-30);
            multRotationZ(45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.1, -0.15]);
            multRotationX(30);
            multRotationZ(45);
            Connection();
        popMatrix();
    }

    function Blade()
    {
        multTranslation([0.5, 0.7, 0.0]);
        multScale([1.0, 0.015, 0.05]);

        uploadModelView();
        SPHERE.draw(gl, program, worldOptions.Mode);
    }
   
    function Blades()
    {
        pushMatrix();
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(90);
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(180);
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(270);
            Blade();
        popMatrix();
    }

    function HelicopterParts() 
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1, 0.0, 1.0)); //Helicopter color
        pushMatrix();
            Body();
        popMatrix();
        pushMatrix();
            Tail();
        popMatrix();
        pushMatrix();
            TailFin();
        popMatrix();
        pushMatrix();
            TailMast();
        popMatrix();
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.0, 0.0, 0.0)); //Blades color
        pushMatrix();
            multRotationY(360 * bladeTime);
            Blades();
            Mast();
        popMatrix();
        pushMatrix();
            multTranslation([1.2, 0.62, 0.13]);
            multRotationZ(360 * bladeTime);
            TailBlades();
        popMatrix();
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.0, 0.0, 0.0)); //LandingSkids color
        pushMatrix();
            LandingSkids()
        popMatrix(); 
        pushMatrix();
            Connections()
        popMatrix(); 
    }

    function updateHeight()
    {   
        heliHeight.setValue(height.toFixed(1));
        let heightFactorOnSpeed = height * 0.3; //Controls the blade speed according to the height
        //(the highest the helicopter is, the fastest the blades spin)
        if(motorVelocity == 0){
           height -= 0.04 * heliOptions.Speed;
           if(height > 0) //When the helicopter is falling
           bladeTime += worldOptions.Speed * heliOptions.Speed;
        }else{
            bladeTime += (heightFactorOnSpeed + 0.2) * worldOptions.Speed * motorVelocity * heliOptions.Speed*3; //Smoothing the blade stopping animation
        if(motorVelocity == 1)
            height -= 0.01 * heliOptions.Speed;
        if(motorVelocity == 2)
            height -= 0.005 * heliOptions.Speed;
        if(motorVelocity == 4)
            height += 0.0025 * heliOptions.Speed;
        if(motorVelocity == 5)
            height += 0.005 * heliOptions.Speed;
        if(motorVelocity == 6)
            height += 0.0075 * heliOptions.Speed;
        if(motorVelocity == 7)
            height += 0.01 * heliOptions.Speed;
        if(motorVelocity == 8)
            height += 0.02 * heliOptions.Speed;
        }

        if(height < FLOOR)
            height = FLOOR;
        else if (height > worldOptions.Ceiling)
            height = worldOptions.Ceiling;
    }

    function HelicopterMovement()
    {
        
        updateHeight();
        multTranslation([heliOptions.Radius, height, 0.0]); // Initial Helicopter pos
        multRotationY(-90);
        if(isMovingLeft && height > FLOOR) { // Can move only when it s in the air and key is pressed.
            heliTime += worldOptions.Speed * (motorVelocity + 1) * heliOptions.Speed/5; //(motorVelocity + 1) so that it can move left while falling
            multTranslation([0.0, 0.0, heliOptions.Radius]); // Translation to rotation on Y.
            multRotationY(360 * heliTime);
            multTranslation([heliOptions.Radius, 0, 0.0]); // Radius of Y rotation
            multRotationY(-90); // Helicopter front in direction to the movement.
            leaningAngle < 0 ? leaningAngle = 0 : leaningAngle = leaningAngle + 0.5;
            multRotationX(leaningAngle * motorVelocity/MAXIMUM_VELOCITY_LEVEL);// Helicopter twisting sideways to make left movement realistic.
            multRotationZ(leaningAngle * motorVelocity/MAXIMUM_VELOCITY_LEVEL); // Helicopter Z angle (30 dg maximum) that changes acording to speed
            heliLeanAng.setValue(leaningAngle * motorVelocity/MAXIMUM_VELOCITY_LEVEL);
            //Stabilization
            if(leaningAngle == 30) //gradual acceleration
                leaningAngle = leaningAngle - 0.5;
            if(leaningAngle >= 1 && height <= 0.27) //soft landing
                leaningAngle--;
                if(motorVelocity <= 1) //So that the helicopter model doesnt enter the ground.
                    leaningAngle <= 0 ? leaningAngle = -0.1 : leaningAngle = leaningAngle - 3;
        }
        else{
            multTranslation([0.0, 0.0, heliOptions.Radius]);
            multRotationY(360 * heliTime);
            multTranslation([heliOptions.Radius, 0, 0.0]);
            multRotationY(-90);
            //Stabilization mechanism
            if(leaningAngle > 0){
                leaningAngle = leaningAngle - 0.5;
                multRotationX(leaningAngle);
                multRotationZ(leaningAngle);
                if(leaningAngle >= 1 && height <= 0.27) //soft landing
                    leaningAngle--;
            } else
                leaningAngle = 0;
        }
    }

    function Helicopter()
    {
        multScale([2.5,2.5,2.5]);
        pushMatrix();
            HelicopterMovement();
            multScale([heliOptions.Scale,heliOptions.Scale,heliOptions.Scale]);
            HelicopterParts();
            heliView = modelView();
        popMatrix();
    }

    function CargoBoxSide() 
    {
        multTranslation([0.0, 0.425, 0.52]);
        multScale([1.0,0.1,0.1]);
        uploadModelView();
        CUBE.draw(gl, program, worldOptions.Mode);
    }

    function Cross()
    {
        multRotationZ(45);
            pushMatrix();
                multTranslation([0.0, -0.2125, 0.0]);
                multScale([1.06,0.5,1.0]);
                CargoBoxSide();
            popMatrix();
            pushMatrix();
                multTranslation([0.2125,0.0, 0.0]);
                multRotationZ(90);
                multScale([1.06,0.5,1.0]);
                CargoBoxSide();
            popMatrix();
    }

    function CargoBoxFaceSides() 
    {
        pushMatrix();
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,-0.85,0.0]);
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multRotationZ(90);
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multRotationZ(-90);
            CargoBoxSide();
        popMatrix();
    }

    function CargoBody()
    {
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
    }

    function CargoBox()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.6, 0.3, 0.0)); //Box color

        pushMatrix();
            multTranslation([0.0, 0.5, 0.0]);
            multScale([0.2,0.2,0.2]);
            pushMatrix();
                CargoBody();
            popMatrix();
            gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.15, 0.0)); //Sides color
            //left face
            pushMatrix();
                CargoBoxFaceSides();
            popMatrix();
            //top face
            pushMatrix();
                multRotationX(-90);
                pushMatrix();
                    Cross();
                popMatrix();
                CargoBoxFaceSides();
            popMatrix();
            //front face
            pushMatrix();
                multRotationY(90);
                CargoBoxFaceSides();
            popMatrix();
            //right face
            pushMatrix();
                multRotationY(-90);
                CargoBoxFaceSides();
            popMatrix();
            //bottom face
            pushMatrix();
                multRotationX(90);
                CargoBoxFaceSides();
            popMatrix();
            //back face
            pushMatrix();
                multRotationX(180);
                CargoBoxFaceSides();
            popMatrix();
        popMatrix();
    }

    function WallSupport()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.15, 0.0)); //Sides color
        pushMatrix();
            multTranslation([0.8,0.735,0.0]);
            multRotationZ(45);
            multScale([0.075,2.0,0.075]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function WallStake()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));
        pushMatrix();
            multTranslation([0.0,1.25,0.0]);
            multScale([0.075,2.5,0.075]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function WallPart()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));
        pushMatrix();
            multTranslation([0.0,1.0,0.0]);
            multScale([0.3,2.0,3.0]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function Wall()
    {
        pushMatrix();
            WallPart();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,3.0]);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-3.0]);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,6.0]);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-6.0]);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.24,0.0,8.8]);
            multRotationY(10);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.24,0.0,-8.8]);
            multRotationY(-10);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.72,0.0,11.4]);
            multRotationY(10);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.72,0.0,-11.6]);
            multRotationY(-10);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([1.5,0.0,14.2]);
            multRotationY(20);
            pushMatrix();
                multTranslation([0.05,0.0,9.0])
                multScale([1.8,1.15,1.8]);
                WallStake();
                WallSupport();
                popMatrix();
            multScale([1.0,1.0,4.35]);
            multTranslation([0.0,0.0,1.13]);
            WallPart();
        popMatrix();
        pushMatrix();
            multTranslation([1.4,0.0,-14.2]);
            multRotationY(-20);
                pushMatrix();
                multTranslation([0.05,0.0,-9.0])
                multScale([1.8,1.15,1.8]);
                WallStake();
                WallSupport();
                popMatrix();
            multScale([1.0,1.0,4.35]);
            multTranslation([0.03,0.0,-1.15]);
            WallPart();
        popMatrix();
    }

    function Building()
    {
        pushMatrix();
            multTranslation([22.6,3.5,-22.6]);
            multScale([4.5, 7.0, 4.5]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function BuildingDestruction() 
    {     
        pushMatrix();
            multScale([0.5, 2.0, 4.5]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function BuildingDestructed()
    {
    pushMatrix();
        multTranslation([23.6,8.0,-2.3]);
        multRotationY(-180);
        multScale([2.0,1.0,1.0]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.6,4.2,-1.6]);
        multRotationX(45);
        multScale([1.0,1.5,0.2]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([23.0,2.0,-18.6]);
        pushMatrix();
            multTranslation([-0.75,-2.2,3.1]);
            multRotationY(-75);
            multRotationX(-25);
            multRotationZ(45);
            Window();
        popMatrix();
        multRotationX(45);
        multRotationZ(-35);
        multScale([1.0,1.0,0.8]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.6,4.2,-3.9]);
        multRotationX(-30);
        multScale([2.0,2.0,0.2]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.4, 7.5, 0.67]);
        multScale([7.25, 4.0, 0.7]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([15.5,15.5, 0.61]);
        multScale([0.3,0.15,0.3]);
        Building();
    popMatrix();
    pushMatrix();
        multTranslation([22.4,9.5,-6.1]);
        multScale([7.25, 6.0, 0.7]);
        BuildingDestruction();
    popMatrix();  
    pushMatrix();
        multTranslation([4.3,0.0,47.0]);
        multScale([0.8, 0.5, 2.2]);
        Building();  
    popMatrix();
    }
    
    function Buildings()
    {
            pushMatrix();
                multTranslation([22.1,8.0,-24.6]);
                multRotationY(90);
                multScale([1.0,1.0,0.8]);
                BuildingDestruction();
            popMatrix();
            pushMatrix();
                multTranslation([24.35,8.0,-22.6]);
                multScale([2.0,1.0,1.0]);
                BuildingDestruction();
            popMatrix();
            Building();
            pushMatrix();
                multTranslation([2.5,0.0,69.5]);
                multScale([0.9, 1.2, 2.2]);
                Building();
            popMatrix();
            pushMatrix();
                gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1.0,0.3,0.3));
                multTranslation([22.85,9.9,19.75]);
                multRotationY(180);
                multScale([4.1,3.0,10.0]);
                uploadModelView();
                PYRAMID.draw(gl, program, worldOptions.Mode);
            popMatrix();
            gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.1, .1, .1));
    }

    function AllBuildings()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.1, .1, .1));
        
        pushMatrix();
            Buildings();
            multTranslation([-2.0,0.0,0.0]);
            BuildingDestructed();
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.4, .4, .4));

        AllWindows();
    }

    function WheelDetail()
    {
        pushMatrix();
            multTranslation([0.0,0.0,0.02]);
            multScale([0.5,0.5,1.0]);
            SmallWheels();
        popMatrix();
    }

    function SmallWheels()
    {
        pushMatrix();
            multTranslation([0.0,0.0,0.07]);
            multScale([0.15,0.15,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        
    }

    function TankWheels()
    {
        pushMatrix();
            multScale([1.5,0.3,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,0.03])
            multScale([1.5,0.2,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        pushMatrix();
            multScale([1.25,1.25,1.25]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([0.25,0.0,0.0]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([-0.25,0.0,0.0]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([-0.425,0.0,0.01]);
            multScale([0.75,0.75,0.75]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([0.425,0.0,0.01]);
            multScale([0.75,0.75,0.75]);
            SmallWheels();
            WheelDetail();
        popMatrix();

    }

    function TankCannon()
    {
        pushMatrix();
            multTranslation([1.0,0.1,0.0]);
            multRotationZ(-88);
            multScale([0.1,3.0,0.1]);
            uploadModelView();
            CYLINDER.draw(gl, program, worldOptions.Mode);
            pushMatrix();
                multTranslation([0.0,0.5,0.0]);
                multScale([1.5,0.1,1.5]);
                uploadModelView();
                CYLINDER.draw(gl, program, worldOptions.Mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,-0.15,0.0]);
                multScale([3.0,0.1,3.0]);
                uploadModelView();
                CYLINDER.draw(gl, program, worldOptions.Mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,-0.05,0.0]);
                multScale([2.0,0.1,2.0]);
                uploadModelView();
                CYLINDER.draw(gl, program, worldOptions.Mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,0.0,0.0]);
                multScale([1.5,0.1,1.5]);
                uploadModelView();
                CYLINDER.draw(gl, program, worldOptions.Mode); 
            popMatrix();
        popMatrix();
    }

    function TankBody()
    {
        pushMatrix();
            multTranslation([0.0,0.09,0.0]);
            multScale([1.5,0.15,1.5]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        //Init TankHead
        pushMatrix();
            pushMatrix();
                multScale([1.0,1.0,0.50]);
                multTranslation([0.0,0.3,0.0]);
                multScale([0.4,0.2,0.8]);
                uploadModelView();
                CUBE.draw(gl, program, worldOptions.Mode);
                multTranslation([0.0,0.1,0.0]);
                TankCannon();
                multTranslation([-0.75,0.5,0.2]);
                pushMatrix();
                    multTranslation([0.0,0.1,0.0]);
                    multRotationZ(65);
                    multScale([0.02,0.75,0.04]);
                    uploadModelView();
                    CYLINDER.draw(gl, program, worldOptions.Mode);
                popMatrix();
                pushMatrix();
                    multTranslation([0.33,-0.12,0.0]);
                    multScale([0.1,0.3,0.1]);
                    uploadModelView();
                    SPHERE.draw(gl, program, worldOptions.Mode);
                popMatrix();
                pushMatrix();
                    multTranslation([0.75,0.2,0.0]);
                    multRotationX(90);
                    multScale([0.3,0.3,0.3]);
                    uploadModelView();
                    SPHERE.draw(gl, program, worldOptions.Mode);
                    multTranslation([0.0,-1.3,0.0]);
                    uploadModelView();
                    SPHERE.draw(gl, program, worldOptions.Mode);
                popMatrix();
            popMatrix();
                multTranslation([0.0,0.4,0.0]);
                multScale([0.2,0.2,0.4]);
                multRotationY(120 * time);
                uploadModelView();
                SPHERE.draw(gl, program, worldOptions.Mode);
                multTranslation([0.0,0.2,0.0]);
                multScale([0.5,0.5,0.5]);
                TankCannon();
        popMatrix();
        //End TankHead
        pushMatrix();
            multTranslation([0.0,0.24,0.0]);
            multScale([1.5,0.15,1.5]);
            uploadModelView();
            PYRAMID.draw(gl, program, worldOptions.Mode);
        popMatrix();
    }

    function Tank() {
        multTranslation([0.0,0.1,0.0]);
        multScale([2.0,2.0,2.0]);
        pushMatrix();
            multTranslation([0.0,0.0,0.4]);
            TankWheels();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-0.4]);
            multRotationY(180);
            TankWheels();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,-0.05,0.0]);
            multScale([0.98,1.0,0.5]);
            TankBody();
        popMatrix();
    }

    function Tanks()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.4, .4, .4));

        pushMatrix();
            multTranslation([0.0,0.15,0.0]);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-2.5,0.15,11.0]);
            multRotationY(10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([5.0,0.15,-20.0]);
            multRotationY(-20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([5.0,0.15,20.0]);
            multRotationY(20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-2.5,0.15,-11.0]);
            multRotationY(-10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-7.5,0.15,20.0]);
            multRotationY(20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-7.5,0.15,-20.0]);
            multRotationY(-20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-15.0,0.15,10.0]);
            multRotationY(10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-15.0,0.15,-10.0]);
            multRotationY(-10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-20.0,0.15,20.0]);
            multRotationY(20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-20.0,0.15,-20.0]);
            multRotationY(-20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-12.5,0.15,0.0]);
            Tank();
        popMatrix();

    }

    function Window() 
    {
        pushMatrix();
            multTranslation([0.0,3.5,0.0]);
            multScale([1.5, 1.5, .04]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,4.25,0.1]);
            multScale([1.5, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,2.75,0.1]);
            multScale([1.5, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.8,3.5,0.1]);
            multRotationZ(-90);
            multScale([1.7, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();  
        pushMatrix();
            multTranslation([-0.8,3.5,0.1]);
            multRotationZ(-90);
            multScale([1.7, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, worldOptions.Mode);
        popMatrix();                      
    }

    function AllWindows() {
        pushMatrix();
            multTranslation([20.5,4.5,0.22]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.5,0.5,0.22]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,4.5,-1.32]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,0.5,-1.32]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,0.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,-1.9,-3.5]);
            multRotationX(-15);
            multRotationY(-65);
            multRotationZ(15);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,8.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,4.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.5,8.5,-6.5]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([22.5,1.8,-20.35]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([22.5,-1.5,-20.35]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.3,-1.5,-22.7]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.3,1.8,-22.7]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([23.0,3.0,24.75]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([23.0,-0.8,24.75]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,3.0,22.0]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,3.0,18.0]);
             multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,-0.8,22.0]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,-0.8,18.0]);
            multRotationY(-90);
            Window();
        popMatrix();
    }

    function World()
    {
        

        Helicopter();

        pushMatrix();
            multTranslation([0.0,-0.4,0.0]);
            DropBox();
        popMatrix();

        pushMatrix();
            multTranslation([10.0,0.0,0.0]);
            WallStake();
            Wall();
        popMatrix();

        AllBuildings();

        Tanks();

        Ground();
    }

    function render()
    {
        time += worldOptions.Speed;
        window.requestAnimationFrame(render);
        gl.useProgram(program);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if(thirdPerson){
            
            mModel = mult(inverse(mView), heliView);
            posCamera = mult(mModel, vec4(0.0,0.0,0.0,1.0));
            atCamera = mult(mModel, vec4(0.0,0.0,2.0,1.0));
            mView = lookAt([posCamera[0], posCamera[1], posCamera[2]], [atCamera[0], atCamera[1], atCamera[2]], [0,1,0]);
        }
        else{
            mProjection = ortho(-aspect, aspect, -1, 1,-5,5);
        }

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(mView);

        s = camera.Zoom/100 * WORLDSCALE;
        pushMatrix();
            multScale([s,s,s]);
            World();
        popMatrix();

    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))