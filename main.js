var physicsShaderSource = [
    'attribute vec3 aPosition;',
    'attribute vec3 aVelocity;',
    'uniform vec3 uLocus;',
    'uniform vec3 uMouse;',
    '',
    'varying vec3 newPosition;',
    'varying vec3 newVelocity;',
    'varying float distance;',
    '',
    'float G = 0.2;',
    'float M = -0.14;',
    '',
    'void main() {',
    '  vec3 particleToMouse = uMouse - aPosition;',
    '  vec3 particleToLocus = uLocus - aPosition;',
    '  float coeff = G / max(length(particleToLocus) * length(particleToLocus), 0.1);',
    '  float mouseCoeff = M / max(length(particleToMouse) * length(particleToMouse), 0.1);',
    '  vec3 acc = (coeff * particleToLocus) + (mouseCoeff * particleToMouse);',
    '',
    '  newPosition = aPosition + aVelocity;',
    '  newVelocity = (aVelocity + acc) * 0.99;',
    '  distance = length(particleToLocus);',
    '}'
].join("\n");

var physicsFragmentShaderSource = [
    'void main() {',
    '  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);',
    '}'
].join("\n");

var renderShaderSource = [
    'precision mediump float;',
    '',
    'attribute vec3 vertPosition;',
    'attribute float vertDistance;',
    'varying vec3 fragColor;',
    '',
    'void main()',
    '{',
    '  float color = clamp(1000.0 / max(1.0, vertDistance * vertDistance), 0.1, 1.0);',
    '  fragColor = vec3(color * 1.0, color * 0.1, color * 0.1);',
    '  gl_PointSize = 1.0;',
    '  gl_Position = vec4(vertPosition.x / 50.0, vertPosition.y / 50.0, 0.0, 1.0);',
    '}'
].join("\n");

var renderFragmentShaderSource = [
    'precision mediump float;',
    '',
    'varying vec3 fragColor;',
    'void main()',
    '{',
    '  gl_FragColor = vec4(fragColor, 1.0);',
    '}'
].join("\n");

var PARTICLES = 500000;

var canvas = undefined;
var gl = undefined;

var hud = undefined;
var ctx = undefined;

var shaders = [];
var FLOATS_PER_PARTICLE = 7;

var physicsProgram = undefined;
var renderProgram = undefined;

var mousex = 10000;
var mousey = 10000;

function initProgram(shaders, varyings) {

    const shaderProgram = gl.createProgram();

    shaders.forEach(shader_info => {
        var shader = loadShader(gl, shader_info.type, shader_info.source);
        if (shader == null)
            return null;

        gl.attachShader(shaderProgram, shader);
    });

    if (varyings && varyings.length > 0) {
        gl.transformFeedbackVaryings(shaderProgram, varyings, gl.INTERLEAVED_ATTRIBS);
    }

    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("an error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function generateResultBuffer(n) {
    var outputBuffer = gl.createBuffer();
    var data = new Float32Array(n * FLOATS_PER_PARTICLE);

    gl.bindBuffer(gl.ARRAY_BUFFER, outputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    return outputBuffer;
}

function generateInitialStates(n) {
    var inputBuffer = gl.createBuffer();
    var data = new Float32Array(n * FLOATS_PER_PARTICLE);
    for (var i = 0; i < n; i++) {
        data[i * FLOATS_PER_PARTICLE + 0] = Math.random() * 3;
        data[i * FLOATS_PER_PARTICLE + 1] = Math.random() * 3;
        data[i * FLOATS_PER_PARTICLE + 2] = 0;

        data[i * FLOATS_PER_PARTICLE + 3] = Math.random() / 5;
        data[i * FLOATS_PER_PARTICLE + 4] = 0;
        data[i * FLOATS_PER_PARTICLE + 5] = 0;
        data[i * FLOATS_PER_PARTICLE + 6] = Math.sqrt(
            data[i * FLOATS_PER_PARTICLE + 0] * data[i * FLOATS_PER_PARTICLE + 0] + 
            data[i * FLOATS_PER_PARTICLE + 1] * data[i * FLOATS_PER_PARTICLE + 1]);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    return inputBuffer;
}

function calculate(inputBuffer, outputBuffer, n) {

    gl.useProgram(physicsProgram);

    var uLocus = gl.getUniformLocation(physicsProgram, 'uLocus');
    gl.uniform3f(uLocus, 0.0, 0.0, 0.0);

    var uMouse = gl.getUniformLocation(physicsProgram, 'uMouse');
    gl.uniform3f(uMouse, mousex, mousey, 0.0);

    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);

    var aPosition = gl.getAttribLocation(physicsProgram, 'aPosition');
    gl.vertexAttribPointer(aPosition,
        3, gl.FLOAT, gl.FALSE,
        FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, // stride
        0);

    var aVelocity = gl.getAttribLocation(physicsProgram, 'aVelocity');
    gl.vertexAttribPointer(aVelocity,
        3, gl.FLOAT, gl.FALSE,
        FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, // stride
        3 * Float32Array.BYTES_PER_ELEMENT
    );

    gl.enableVertexAttribArray(aPosition);
    gl.enableVertexAttribArray(aVelocity);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outputBuffer);

    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.endTransformFeedback();

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
}

function render(inputBuffer, n) {

    gl.useProgram(renderProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
  
    var positionAttribLocation = gl.getAttribLocation(renderProgram, 'vertPosition');
    gl.vertexAttribPointer(
        positionAttribLocation, 3, gl.FLOAT,  gl.FALSE,
        FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, 0
    );
  
    var distanceAttribLocation = gl.getAttribLocation(renderProgram, 'vertDistance');
    gl.vertexAttribPointer(
        distanceAttribLocation, 1, gl.FLOAT,  gl.FALSE,
        FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT, 
        6 * Float32Array.BYTES_PER_ELEMENT
    );

    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(distanceAttribLocation);
  
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, n);
}

function main() {

    canvas = document.getElementById("canvas");
    hud = document.getElementById("hud");
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    hud.width = document.body.clientWidth;
    hud.height = document.body.clientHeight;
    canvas.focus();

    gl = canvas.getContext("webgl2");
    ctx = hud.getContext("2d");
    ctx.font = "20px Consolas";
    hud.onmousemove = (e) => {
        mousex = ((e.clientX - hud.width / 2) / hud.width) * 100;
        mousey = ((e.clientY - hud.height / 2) / hud.height) * -100;
    };
    hud.onmouseleave = (e) => {
        mousex = 10000;
        mousey = 10000;
    }

    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    gl.clearColor(0.2, 0.2, 0.2, 0.4);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, gl.createTransformFeedback());

    physicsProgram = initProgram([
        { source: physicsShaderSource, type: gl.VERTEX_SHADER }, 
        { source: physicsFragmentShaderSource, type: gl.FRAGMENT_SHADER }], 
        ["newPosition", "newVelocity", "distance"]
    );

    renderProgram = initProgram([
        { source: renderShaderSource, type: gl.VERTEX_SHADER }, 
        { source: renderFragmentShaderSource, type: gl.FRAGMENT_SHADER }
    ]);


    var outputBuffer = generateResultBuffer(PARTICLES);
    var inputBuffer = generateInitialStates(PARTICLES);

    var start , calculateTime, renderTime, tmp;
    var loop = function() {

        /* Do the physics simulation */
        start = performance.now();
        calculate(inputBuffer, outputBuffer, PARTICLES);
        calculateTime = (performance.now() - start);

        /* Render the output */
        start = performance.now();
        render(outputBuffer, PARTICLES);
        renderTime = (performance.now() - start);

        /* Make the previous output the next input */
        tmp = inputBuffer;
        inputBuffer = outputBuffer;
        outputBuffer = tmp;

        /* Print some numbers */
        ctx.clearRect(0, 0, hud.width, hud.height);
        ctx.fillStyle = "red";
        ctx.fillText("Particles: " + PARTICLES, 10, 30);
        ctx.fillText("Physics duration: " + calculateTime.toFixed(2), 10, 60);
        ctx.fillText("Render duration: " + renderTime.toFixed(2), 10, 90);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}