var canvas = document.getElementById('window');

var gl = canvas.getContext('webgl');

gl.clearColor(0.5, 0.5, 0.5, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

var vertexShaderString = document.getElementById('vertexShader');
console.log(vertexShaderString);
var vertexShader = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vertexShader, vertexShaderString);
gl.compileShader(vertexShader);
