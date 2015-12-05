var edgesCheckbox;
var blurCheckbox;
var blurCheckbos;
var canvas;
var oceanTheme;

function initHtml() {
  edgesCheckbox = document.getElementById('edges');
  blurCheckbox = document.getElementById('blur');
  waterCheckbox = document.getElementById('water');
  muteCheckbox = document.getElementById('mute');

  oceanTheme = document.getElementById('oceanTheme');

  muteCheckbox.addEventListener('change', function(event) {
    oceanTheme.muted = muteCheckbox.checked;
  })

  canvas = document.getElementById('window');
  canvas.requestPointerLock = canvas.requestPointerLock ||
                              canvas.mozRequestPointerLock ||
                              canvas.webkitRequestPointerLock;
  canvas.onclick = function() {
    canvas.requestPointerLock();
  };

  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  document.addEventListener('mousemove', mouseMove, false);
  document.addEventListener('wheel', scroll);
}

var gl;
var ratio;

function initGL() {
  gl = canvas.getContext('webgl');

  ratio = gl.drawingBufferWidth / gl.drawingBufferHeight;
}

function createShader(name) {
  var script = document.getElementById(name);
  var type;
  if (script.type == 'x-shader/x-vertex') {
    type = gl.VERTEX_SHADER;
  } else if (script.type == 'x-shader/x-fragment') {
    type = gl.FRAGMENT_SHADER;
  } else {
    console.error('INCORRECT SHADER TYPE');
  }
  var shaderString = script.textContent;
  var shader = gl.createShader(type);
  gl.shaderSource(shader, shaderString);
  gl.compileShader(shader);

  var check = gl.getShaderInfoLog(shader);
  if (check) {
    console.log(name + ': ' + check);
  }

  return shader;
}

function createProgram(name, properties) {
  var vertexShader = createShader(name + '-vs');
  var fragmentShader = createShader(name + '-fs');

  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  var check = gl.getProgramInfoLog(program);
  if (check) {
    console.log(name + ': ' + check);
  }

  properties.forEach(function (property) {
    if (property[0] == 'u') {
      program[property] = gl.getUniformLocation(program, property);
    } else if (property[0] == 'a') {
      program[property] = gl.getAttribLocation(program, property);
    }
  });

  return program;
}

var voronoiProgram;
var blurProgram;

function initPrograms() {
  perlinProgram = createProgram('perlin', [
    'aPos',
  ]);

  voronoiProgram = createProgram('voronoi', [
    'aPos',
    'uM',
    'uP',
    'uCol',
  ]);

  edgesProgram = createProgram('edges', [
    'aPos',
    'aTexCoord',
    'uWidth',
    'uHeight',
    'uTexture',
  ]);

  blurProgram = createProgram('blur', [
    'aPos',
    'aTexCoord',
    'uWidth',
    'uHeight',
    'uBlurAmount',
    'uDir',
    'uTexture',
  ]);

  waterProgram = createProgram('water', [
    'aPos',
    'aTexCoord',
    'uTexture',
  ]);

  shadowProgram = createProgram('shadow', [
    'uM',
    'uV',
    'uP',
    'aPos',
  ]);

  testProgram = createProgram('test', [
    'aPos',
    'aTexCoord',
    'uTexture',
  ]);

  sceneProgram = createProgram('scene', [
    'aPos',
    'aNorm',
    'aTexCoord',
    'uModelView',
    'uNormalMatrix',
    'uP',
    'uBias',
    'uLightV',
    'uLightP',
    'uLightDir',
    'uViewLightDir',
    'uShadowMap',
    'uTexture',
    'uIslandTexture',
    'uSunlightTexture',
    'uSkyTexture',
    'uTexScale',
    'uBoatPos',
    'uFrame',
    'uIsWater',
    'uIsIsland',
    'uIsBackground',
    'uIsSun',
    'uIslandHeight',
  ]);

  cutoffProgram = createProgram('cutoff', [
    'aPos',
    'aTexCoord',
    'uTexture',
  ]);

  bloomProgram = createProgram('bloom', [
    'aPos',
    'aTexCoord',
    'uOriginal',
    'uShine',
  ]);
}

function genCone() {
  verts = [];
  verts.push(0, 0, -2)

  var r = 2;
  var numVerts = 8;
  for (var i = 0; i < numVerts + 1; i++) {
    var theta = i * 2 * Math.PI / numVerts;
    verts.push(
      r * Math.cos(theta),
      r * Math.sin(theta),
      -3
    );
  }

  return {
    verts: new Float32Array(verts),
    numItems: numVerts + 2,
  };
}

function genRect() {
  var verts = [
    -1,  1, 0,
     1,  1, 0,
    -1, -1, 0,
    -1, -1, 0,
     1,  1, 0,
     1, -1, 0
  ];

  var texCoords = [
    0, 1,
    1, 1,
    0, 0,
    0, 0,
    1, 1,
    1, 0
  ];

  return {
    verts: new Float32Array(verts),
    texCoords: new Float32Array(texCoords),
    numItems: 6,
  };
}

function waterHeight(x, z) {
  return 0.2 * Math.sin(x) * Math.sin(z + frame / 100);
}

function genWater() {
  var size = 50;
  var density = 100;
  var width = size / density;
  var half = width / 2;
  var texScale = 4;

  var verts = [];
  var normals = [];
  var texCoords = [];

  for (var i = -density; i < density; i++) {
    for (var j = -density; j < density; j++) {
      verts.push(
              i * width, 0,       j * width,
        (i + 1) * width, 0,       j * width,
              i * width, 0, (j + 1) * width,
              i * width, 0, (j + 1) * width,
        (i + 1) * width, 0,       j * width,
        (i + 1) * width, 0, (j + 1) * width
      );
    }
  }

  for (var i = 0; i < 2 * density; i++) {
    for (var j = 0; j < 2 * density; j++) {
      texCoords.push(
              i * width / texScale,       j * width / texScale,
        (i + 1) * width / texScale,       j * width / texScale,
              i * width / texScale, (j + 1) * width / texScale,
              i * width / texScale, (j + 1) * width / texScale,
        (i + 1) * width / texScale,       j * width / texScale,
        (i + 1) * width / texScale, (j + 1) * width / texScale
      );
    }
  }

  for (var i = 0; i < verts.length; i += 3) {
    normals.push(0, 1, 0);
  }

  return {
    verts: new Float32Array(verts),
    normals: new Float32Array(normals),
    texCoords: new Float32Array(texCoords),
    numItems:  6 * (2 * density) * (2 * density),
    texScale:  texScale,
  };
}

function genIsland() {
  var size = 100;
  var density = 200;
  var width = size / density;
  var half = width / 2;

  var verts = [];
  var normals = [];
  var texCoords = [];

  for (var i = -density; i < density; i++) {
    for (var j = -density; j < density; j++) {
      verts.push(
              i * width, 0,       j * width,
        (i + 1) * width, 0,       j * width,
              i * width, 0, (j + 1) * width,
              i * width, 0, (j + 1) * width,
        (i + 1) * width, 0,       j * width,
        (i + 1) * width, 0, (j + 1) * width
      );
    }
  }

  for (var i = 0; i < 2 * density; i++) {
    for (var j = 0; j < 2 * density; j++) {
      texCoords.push(
              i / (2 * density),       j / (2 * density),
        (i + 1) / (2 * density),       j / (2 * density),
              i / (2 * density), (j + 1) / (2 * density),
              i / (2 * density), (j + 1) / (2 * density),
        (i + 1) / (2 * density),       j / (2 * density),
        (i + 1) / (2 * density), (j + 1) / (2 * density)
      );
    }
  }

  for (var i = 0; i < verts.length; i += 3) {
    normals.push(0, 1, 0);
  }

  return {
    verts: new Float32Array(verts),
    normals: new Float32Array(normals),
    texCoords: new Float32Array(texCoords),
    numItems:  6 * (2 * density) * (2 * density),
  };
}

function genObj(object) {
  var textures = {};

  for (var key in object.textures) {
    textures[key] = createTexture({ image: object.textures[key], clampToEdge: true });
  }

  return {
    verts: new Float32Array(object.verts),
    normals: new Float32Array(object.normals),
    texCoords: new Float32Array(object.texCoords),
    numItems: object.verts.length / 3,
    groups: object.groups,
    textures: textures,
  }
}

function createTexture(options) {
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (options.clampToEdge) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  if (options.image) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, options.image);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, options.width, options.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

function createRenderBuffer(options) {
  var renderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, options.width, options.height);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  return renderBuffer;
}

function createFrameBuffer(options) {
  var texture = createTexture(options);
  var renderBuffer = createRenderBuffer(options);
  var buffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    texture: texture,
    buffer: buffer,
    width: options.width,
    height: options.height,
  }
}

var coneBuffer;
var rectBuffer;
var rectTexBuffer;
var waterBuffer;
var waterNormBuffer;
var waterTexBuffer;
var islandBuffer;
var islandNormBuffer;
var islandTexBuffer;
var link;
var linkBuffer;
var linkNormBuffer;
var linkTexBuffer;
var cylinder;
var cylinderBuffer;
var cylinderNormBuffer;
var cylinderTexBuffer;
var islandTexture;
var sunlightTexture;
var skyTexture;

var lastFrame;
var perlinFrame;
var voronoiFrame;
var edgesFrame;
var horizontalBlurFrame;
var blurFrame;
var waterFrame;
var sceneFrame;
var cutoffFrame;

function initBuffers() {
  var cone = genCone();
  coneBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cone.verts, gl.STATIC_DRAW)
  coneBuffer.numItems = cone.numItems;

  var rect = genRect();
  rectBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.verts, gl.STATIC_DRAW)
  rectBuffer.numItems = rect.numItems;

  rectTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, rect.texCoords, gl.STATIC_DRAW);

  var water = genWater();
  waterBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.verts, gl.STATIC_DRAW)
  waterBuffer.numItems = water.numItems;
  waterBuffer.texScale = water.texScale;

  waterNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.normals, gl.STATIC_DRAW);

  waterTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, waterTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, water.texCoords, gl.STATIC_DRAW);

  var island = genIsland();
  islandBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, islandBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, island.verts, gl.STATIC_DRAW)
  islandBuffer.numItems = island.numItems;
  islandBuffer.texScale = island.texScale;

  islandNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, islandNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, island.normals, gl.STATIC_DRAW);

  islandTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, islandTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, island.texCoords, gl.STATIC_DRAW);

  link = genObj(toonLink);
  linkBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.verts, gl.STATIC_DRAW);

  linkNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.normals, gl.STATIC_DRAW);

  linkTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, linkTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, link.texCoords, gl.STATIC_DRAW);

  cylinder = genObj(cylinderObj);
  cylinderBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cylinder.verts, gl.STATIC_DRAW);

  cylinderNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cylinder.normals, gl.STATIC_DRAW);

  cylinderTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cylinder.texCoords, gl.STATIC_DRAW);

  sphere = genObj(sphereObj);
  sphereBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.verts, gl.STATIC_DRAW);

  sphereNormBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.normals, gl.STATIC_DRAW);

  sphereTexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereTexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, sphere.texCoords, gl.STATIC_DRAW);

  islandTexture = createTexture({ image: islandImage, clampToEdge: true });
  sunlightTexture = createTexture({ image: sunlightImage, clampToEdge: true });
  skyTexture = createTexture({ image: skyImage, clampToEdge: true });
  sunTexture = createTexture({ image: sunImage, clampToEdge: true });

  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  perlinFrame = createFrameBuffer({ width: 2048, height: 2048 });
  voronoiFrame = createFrameBuffer({ width: 2048, height: 2048 });
  edgesFrame = createFrameBuffer({ width: 2048, height: 2048 });
  horizontalBlurFrame = createFrameBuffer({ width: 2048, height: 2048 });
  blurFrame = createFrameBuffer({ width: 2048, height: 2048 });
  waterFrame = createFrameBuffer({ width: 2048, height: 2048 });
  shadowFrame = createFrameBuffer({ width: 2048, height: 2048, clampToEdge: true });
  sceneFrame = createFrameBuffer({ width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, clampToEdge: true });
  cutoffFrame = createFrameBuffer({ width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, clampToEdge: true });
}

var regions = [];
function initRegions() {
  for (var i = 0; i < 20; i++) {
    regions.push({
      pos: [Math.random() * 2 - 1, Math.random() * 2 - 1, 0],
      colour: [Math.random(), Math.random(), Math.random()],
      dir: 2 * Math.PI * Math.random(),
      speed: 0.00025 * Math.random() + 0.00025,
    });
  }
}

function moveRegions() {
  regions.forEach(function (region) {
    region.pos[0] += region.speed * Math.cos(region.dir);
    region.pos[1] += region.speed * Math.sin(region.dir);
    region.direction += 0.4 * Math.random() - 0.2;

    if (region.pos[0] > 1) {
      region.pos[0] = -1;
    } else if (region.pos[0] < -1) {
      region.pos[0] = 1;
    }
    if (region.pos[1] > 1) {
      region.pos[1] = -1;
    } else if (region.pos[1] < -1) {
      region.pos[1] = 1;
    }
  });
}

var M = mat4.create();
var V = mat4.create();
var P = mat4.create();
var orthoProj = mat4.create();
var perspProj = mat4.create();

function drawPerlin() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, perlinFrame.buffer);
  gl.useProgram(perlinProgram);
  gl.viewport(0, 0, perlinFrame.width, perlinFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(perlinProgram.aPos);
  gl.vertexAttribPointer(perlinProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawVoronoi() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, voronoiFrame.buffer);
  gl.useProgram(voronoiProgram);
  gl.viewport(0, 0, voronoiFrame.width, voronoiFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var ratio = voronoiFrame.width / voronoiFrame.height;
  mat4.identity(M);
  mat4.ortho(P, -1, 1, -1, 1, 0, 10);

  gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
  gl.uniformMatrix4fv(voronoiProgram.uP, false, P);

  for (var i = 0; i < 9; i++) {
    var x = Math.floor(i / 3);
    var y = i % 3;
    var zone = [2 * ratio * (x - 1), 2 * (y - 1), 0]

    for (var j = 0; j < regions.length; j++) {
      mat4.translate(M, mat4.create(), vec3.add([], regions[j].pos, zone));

      gl.uniformMatrix4fv(voronoiProgram.uM, false, M);
      gl.uniform3fv(voronoiProgram.uCol, regions[j].colour);

      gl.bindBuffer(gl.ARRAY_BUFFER, coneBuffer);
      gl.enableVertexAttribArray(voronoiProgram.aPos);
      gl.vertexAttribPointer(voronoiProgram.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, coneBuffer.numItems);
    }
  }

  lastFrame = voronoiFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawEdges() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, edgesFrame.buffer);
  gl.useProgram(edgesProgram);
  gl.viewport(0, 0, edgesFrame.width, edgesFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(edgesProgram.uWidth, edgesFrame.width);
  gl.uniform1i(edgesProgram.uHeight, edgesFrame.height);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(edgesProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(edgesProgram.aPos);
  gl.vertexAttribPointer(edgesProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(edgesProgram.aTexCoord);
  gl.vertexAttribPointer(edgesProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = edgesFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawBlur(blurAmount) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, horizontalBlurFrame.buffer);
  gl.useProgram(blurProgram);
  gl.viewport(0, 0, horizontalBlurFrame.width, horizontalBlurFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform1i(blurProgram.uWidth, horizontalBlurFrame.height);
  gl.uniform1i(blurProgram.uHeight, horizontalBlurFrame.height);
  gl.uniform1f(blurProgram.uBlurAmount, blurAmount);
  gl.uniform2fv(blurProgram.uDir, [1, 0]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = horizontalBlurFrame;

  gl.bindFramebuffer(gl.FRAMEBUFFER, blurFrame.buffer);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.uniform2fv(blurProgram.uDir, [0, 1]);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(blurProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(blurProgram.aPos);
  gl.vertexAttribPointer(blurProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(blurProgram.aTexCoord);
  gl.vertexAttribPointer(blurProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = blurFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawWater() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, waterFrame.buffer);
  gl.useProgram(waterProgram);
  gl.viewport(0, 0, waterFrame.width, waterFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(waterProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(waterProgram.aPos);
  gl.vertexAttribPointer(waterProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(waterProgram.aTexCoord);
  gl.vertexAttribPointer(waterProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = waterFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

var lightV = mat4.create();
var lightP = mat4.create();

function drawShadow() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFrame.buffer);
  gl.useProgram(shadowProgram);
  gl.viewport(0, 0, shadowFrame.width, shadowFrame.height);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var center = vec3.create();
  vec3.add(center, boat.pos, [0, 0.5, 0]);
  mat4.lookAt(lightV, light.pos, center, [0, 1, 0]);
  mat4.ortho(lightP, -1, 1, -1, 1, 0, 2 * light.dist);

  mat4.identity(M);
  mat4.translate(M, M, boat.pos);
  mat4.rotateY(M, M, boat.direction);
  mat4.rotateX(M, M, -boat.pitch);
  mat4.translate(M, M, [0, 0, boat.offset]);
  mat4.scale(M, M, [0.002, 0.002, 0.002]);

  gl.uniformMatrix4fv(shadowProgram.uM, false, M);
  gl.uniformMatrix4fv(shadowProgram.uV, false, lightV);
  gl.uniformMatrix4fv(shadowProgram.uP, false, lightP);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
  gl.enableVertexAttribArray(shadowProgram.aPos);
  gl.vertexAttribPointer(shadowProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, link.numItems);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawScene() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFrame.buffer);
  gl.useProgram(sceneProgram);
  gl.viewport(0, 0, sceneFrame.width, sceneFrame.height);
  gl.clearColor(0.2, 0.8, 1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.identity(M);

  var cameraPos = [0, 0, 0];
  vec3.add(cameraPos, camera.pos, [boat.pos[0], 0, boat.pos[2]]);

  var center = vec3.create();
  vec3.add(center, boat.pos, [0, 0.2, 0]);
  mat4.lookAt(V, cameraPos, center, [0, 1, 0]);

  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  var normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelView);
  mat4.transpose(normalMatrix, normalMatrix);

  var bias = [
    0.5,   0,   0, 0,
      0, 0.5,   0, 0,
      0,   0, 0.5, 0,
    0.5, 0.5, 0.5, 1
  ];

  gl.uniformMatrix4fv(sceneProgram.uBias, false, bias);
  gl.uniformMatrix4fv(sceneProgram.uLightV, false, lightV);
  gl.uniformMatrix4fv(sceneProgram.uLightP, false, lightP);
  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);
  gl.uniformMatrix4fv(sceneProgram.uNormalMatrix, false, normalMatrix);
  gl.uniformMatrix4fv(sceneProgram.uP, false, perspProj);
  gl.uniform1i(sceneProgram.uFrame, frame);
  gl.uniform1f(sceneProgram.uTexScale, waterBuffer.texScale);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, shadowFrame.texture);
  gl.uniform1i(sceneProgram.uShadowMap, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, perlinFrame.texture);
  gl.uniform1i(sceneProgram.uIslandHeight, 2);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, islandTexture);
  gl.uniform1i(sceneProgram.uIslandTexture, 3);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, sunlightTexture);
  gl.uniform1i(sceneProgram.uSunlightTexture, 4);
  gl.uniform1i(sceneProgram.uIsWater, true);

  var lightDir = [light.dir[0], light.dir[1], light.dir[2], 0];
  vec4.transformMat4(lightDir, lightDir, V);
  lightDir = [lightDir[0], lightDir[1], lightDir[2]]
  gl.uniform3fv(sceneProgram.uLightDir, light.dir);
  gl.uniform3fv(sceneProgram.uViewLightDir, lightDir);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(sceneProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, waterTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, waterBuffer.numItems);
  gl.uniform1i(sceneProgram.uIsWater, false);

  gl.uniform1i(sceneProgram.uIsIsland, true);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, perlinFrame.texture);
  gl.uniform1i(sceneProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, islandBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, islandNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, islandTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, islandBuffer.numItems);
  gl.uniform1i(sceneProgram.uIsIsland, false);

  mat4.identity(M);
  mat4.translate(M, M, boat.pos);
  mat4.rotateY(M, M, boat.direction);
  mat4.rotateX(M, M, -boat.pitch);
  mat4.translate(M, M, [0, 0, boat.offset]);
  mat4.scale(M, M, [0.002, 0.002, 0.002]);

  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  var normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelView);
  mat4.transpose(normalMatrix, normalMatrix);

  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);
  gl.uniformMatrix4fv(sceneProgram.uNormalMatrix, false, normalMatrix);
  gl.uniform3fv(sceneProgram.uBoatPos, boat.pos);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, linkTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  for (var i = 0; i < link.groups.length; i++) {
    var group = link.groups[i];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, link.textures[group.material]);
    gl.uniform1i(sceneProgram.uTexture, 0);

    gl.drawArrays(gl.TRIANGLES, group.offset, group.size);
  }

  M = mat4.create();
  mat4.translate(M, M, cameraPos);
  mat4.translate(M, M, [0, -3, 0 ]);
  mat4.scale(M, M, [45, 25, 45]);
  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);

  gl.uniform1i(sceneProgram.uIsBackground, true);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, skyTexture);
  gl.uniform1i(sceneProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, cylinderTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, cylinder.numItems);
  gl.uniform1i(sceneProgram.uIsBackground, false);

  M = mat4.create();
  mat4.translate(M, M, light.sun);
  mat4.scale(M, M, [light.sunSize, light.sunSize, light.sunSize]);
  var modelView = mat4.create();
  mat4.multiply(modelView, V, M);

  gl.uniform1i(sceneProgram.uIsSun, true);
  gl.uniformMatrix4fv(sceneProgram.uModelView, false, modelView);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sunTexture);
  gl.uniform1i(sceneProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffer);
  gl.enableVertexAttribArray(sceneProgram.aPos);
  gl.vertexAttribPointer(sceneProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNormBuffer);
  gl.enableVertexAttribArray(sceneProgram.aNorm);
  gl.vertexAttribPointer(sceneProgram.aNorm, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, sphereTexBuffer);
  gl.enableVertexAttribArray(sceneProgram.aTexCoord);
  gl.vertexAttribPointer(sceneProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, sphere.numItems);
  gl.uniform1i(sceneProgram.uIsSun, false);

  lastFrame = sceneFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawCutoff() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, cutoffFrame.buffer);
  gl.useProgram(cutoffProgram);
  gl.viewport(0, 0, cutoffFrame.width, cutoffFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(cutoffProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(cutoffProgram.aPos);
  gl.vertexAttribPointer(cutoffProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(cutoffProgram.aTexCoord);
  gl.vertexAttribPointer(cutoffProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  lastFrame = cutoffFrame;

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawBloom() {
  gl.useProgram(bloomProgram);
  gl.viewport(0, 0, cutoffFrame.width, cutoffFrame.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneFrame.texture);
  gl.uniform1i(bloomProgram.uOriginal, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, lastFrame.texture);
  gl.uniform1i(bloomProgram.uShine, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(bloomProgram.aPos);
  gl.vertexAttribPointer(bloomProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(bloomProgram.aTexCoord);
  gl.vertexAttribPointer(bloomProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawTest() {
  gl.useProgram(testProgram);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(1, 1, 1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, cutoffFrame.texture);
  gl.uniform1i(testProgram.uTexture, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectBuffer);
  gl.enableVertexAttribArray(testProgram.aPos);
  gl.vertexAttribPointer(testProgram.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, rectTexBuffer);
  gl.enableVertexAttribArray(testProgram.aTexCoord);
  gl.vertexAttribPointer(testProgram.aTexCoord, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, rectBuffer.numItems);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function draw(e) {
  requestAnimationFrame(draw);

  drawVoronoi();
  if (edgesCheckbox.checked) {
    drawEdges();
  }
  if (blurCheckbox.checked) {
    drawBlur(30);
    drawBlur(30);
  }
  if (waterCheckbox.checked) {
    drawWater();
  }

  drawShadow();
  drawScene();
  drawCutoff();
  drawBlur(50);
  drawBlur(50);
  drawBloom();

  //drawTest();
}

var camera = {
  pos: [0, 1, -2],
  direction: 0,
  height: Math.PI / 4,
  distance: 2,
  zoom: 0.1,
};

var boat = {
  pos: [0, 0, 0],
  direction: 0,
  velocity: [0, 0, 0],
  acceleration: 0.003,
  offset: 0.15,
  pitch: 0,
};

var light = {
  rotation: 0.0,
  dir: [0, -1, 0],
  pos: [0, 2.5, 0],
  dist: 1.5,
  animating: true,
  sun: [100, 100, 100],
  sunDist: 40,
  sunSize: 2.5,
};

var frame = 0;

function tick() {
  if (keys.up) {
    var force = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
    vec3.scale(force, force, boat.acceleration);
    vec3.add(boat.velocity, boat.velocity, force);
  }
  if (keys.down) {
    var force = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
    vec3.scale(force, force, -boat.acceleration);
    vec3.add(boat.velocity, boat.velocity, force);
  }
  if (keys.left) {
    boat.direction += 0.04;
  }
  if (keys.right) {
    boat.direction -= 0.04;
  }

  vec3.scale(boat.velocity, boat.velocity, Math.min(24 * Math.pow(vec3.length(boat.velocity), 0.7), 0.95));
  vec3.add(boat.pos, boat.pos, boat.velocity);

  var offsetPos = [Math.sin(boat.direction), 0, Math.cos(boat.direction)];
  vec3.scale(offsetPos, offsetPos, -boat.offset);
  vec3.add(offsetPos, offsetPos, boat.pos);

  var frontHeight = waterHeight(boat.pos[0], boat.pos[2])
  var backHeight = waterHeight(offsetPos[0], offsetPos[2])
  boat.pos[1] = 0.03 + backHeight;

  var front = [boat.offset, frontHeight];
  var back = [0, backHeight];
  boat.pitch = Math.atan2(frontHeight - backHeight, boat.offset);

  camera.pos[1] = camera.distance * Math.cos(camera.height);
  camera.pos[0] = camera.distance * Math.cos(camera.direction) * Math.sin(camera.height);
  camera.pos[2] = camera.distance * Math.sin(camera.direction) * Math.sin(camera.height);

  if (keys.Q) {
    light.rotation -= 0.01;
  } else if (keys.E) {
    light.rotation += 0.01;
  }

  if (light.animating) {
    light.rotation += 0.002;
  }

  light.dir = [Math.cos(light.rotation), 2 * Math.pow(Math.sin(light.rotation / 2), 4) - 1, Math.sin(light.rotation)];

  vec3.scale(light.pos, light.dir, -light.dist);
  vec3.add(light.pos, light.pos, boat.pos);

  vec3.scale(light.sun, light.dir, -light.sunDist);
  vec3.add(light.sun, light.sun, boat.pos);

  moveRegions();

  frame++;
}

function mouseMove(e) {
  var dx = e.movementX;
  var dy = e.movementY;

  camera.direction += 2 * Math.PI * dx / gl.drawingBufferWidth;
  camera.height -= Math.PI / 2 * dy / gl.drawingBufferHeight;
  camera.height = Math.min(Math.max(camera.height, 0.01), Math.PI / 2 - 0.1);
}

function scroll(e) {
  if (e.wheelDelta > 0) {
    camera.distance -= camera.zoom;
    camera.distance = Math.max(camera.distance, 0.4);
  } else if (e.wheelDelta < 0) {
    camera.distance += camera.zoom;
    camera.distance = Math.min(camera.distance, 15);
  }
}

var keys = {};

function mapKey(keyCode) {
  var key = String.fromCharCode(keyCode);

  if (keyCode == 37 || key == 'A') {
    key = 'left';
  } else if (keyCode == 38 || key == 'W') {
    key = 'up';
  } else if (keyCode == 39 || key == 'D') {
    key = 'right';
  } else if (keyCode == 40 || key == 'S') {
    key = 'down';
  } else if (keyCode == 32) {
    key = 'space';
  }

  return key;
}

function keyDown(e) {
  var mapped = mapKey(e.keyCode);
  keys[mapped] = true;
}

function keyUp(e) {
  var mapped = mapKey(e.keyCode);
  keys[mapped] = false;

  if (mapped == 'space') {
    light.animating = !light.animating;
  }
}

function main() {
  initHtml();
  initGL();
  initPrograms();
  initBuffers();
  initRegions();

  mat4.perspective(perspProj, Math.PI / 4, ratio, 0.01, 50);

  gl.enable(gl.DEPTH_TEST);

  drawPerlin(); // We only need to draw this once
  draw();

  setInterval(tick, 1000 / 60);
}

var islandImage = new Image();
var sunlightImage = new Image();
var skyImage = new Image();
var sunImage = new Image();
var cylinderObj;
var sphereObj;
var toonLink = parseObjMtl('assets/linkboat/linkboat', function () {
  cylinderObj = parseObj('assets/cylinder', function () {
    sphereObj = parseObj('assets/sphere', function () {
      islandImage.onload = function () {
        sunlightImage.onload = function () {
          skyImage.onload = function () {
            sunImage.onload = function () {
              main();
            }
            sunImage.src = 'assets/textures/sun.png';
          }
          skyImage.src = 'assets/textures/sky.png';
        }
        sunlightImage.src = 'assets/textures/sunlight.png';
      }
      islandImage.src = 'assets/textures/island.png';
    });
  });
});