function parseObjMtl(name, done) {

  var obj = parseObj(name, function () {
    parseMtl(name, done, obj);
  });

  return obj;
}

function parseObj(name, done) {
  var objRequest = new XMLHttpRequest();

  var obj = {};

  objRequest.onreadystatechange = function () {
    if (objRequest.readyState == 4) {
      var contents = objRequest.responseText;
      var lines = contents.split(/\n+/);

      var verts = [];
      var faces = [];
      var normals = [];
      var texCoords = [];
      var currentGroup = {};

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var tokens = line.split(/\s+/);

        if (tokens[0] == 'v') {
          for (var j = 1; j <= 3; j++) {
            verts.push(parseFloat(tokens[j]));
          }
        } else if (tokens[0] == 'vn') {
          for (var j = 1; j <= 3; j++) {
            normals.push(parseFloat(tokens[j]));
          }
        } else if (tokens[0] == 'vt') {
          for (var j = 1; j <= 2; j++) {
            texCoords.push(parseFloat(tokens[j]));
          }
        } else if (tokens[0] == 'f') {
          for (var j = 1; j <= 3; j++) {
            var face = tokens[j].split('/');
            faces.push({
              v: parseInt(face[0]),
              vt: parseInt(face[1]),
              vn: parseInt(face[2]),
              g: currentGroup
            });
          }
        } else if (tokens[0] == 'usemtl') {
          currentGroup = {
            name: tokens[1],
            material: tokens[1],
          }
        } else {
          continue;
        }
      }

      obj.verts = [];
      obj.normals = [];
      obj.texCoords = [];
      obj.groups = [];

      var previousGroupName = '';
      for (var i = 0; i < faces.length; i++) {
        var face = faces[i];

        if (face.g.name !== previousGroupName) {
          if (obj.groups.length) {
            var lastGroup = obj.groups[obj.groups.length - 1];
            lastGroup.size = obj.verts.length / 3 - lastGroup.offset;
          }

          obj.groups.push({
            offset: obj.verts.length / 3,
            size: 0,
            name: face.g.name,
            material: face.g.material,
          });
        }
        previousGroupName = face.g.name;

        obj.verts.push(
          verts[(face.v - 1) * 3],
          verts[(face.v - 1) * 3 + 1],
          verts[(face.v - 1) * 3 + 2]
        );

        obj.normals.push(
          normals[(face.vn - 1) * 3],
          normals[(face.vn - 1) * 3 + 1],
          normals[(face.vn - 1) * 3 + 2]
        );

        obj.texCoords.push(
          texCoords[(face.vt - 1) * 2],
          texCoords[(face.vt - 1) * 2 + 1]
        );
      }

      if (obj.groups.length) {
        var lastGroup = obj.groups[obj.groups.length - 1];
        lastGroup.size = obj.verts.length / 3 - lastGroup.offset;
      }

      done();
    }
  };

  objRequest.open('GET', name + '.obj', true);
  objRequest.send();

  return obj;
}

function parseMtl(name, done, obj) {
  var mtlRequest = new XMLHttpRequest();

  obj.textures = {};

  mtlRequest.onreadystatechange = function () {
    if (mtlRequest.readyState == 4) {
      var contents = mtlRequest.responseText;
      var lines = contents.split(/\n+/);

      var currentMtl = '';
      var images = [];

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var tokens = line.split(/\s+/);

        if (tokens[0] == 'newmtl') {
          currentMtl = tokens[1];
        } else if (tokens[0] == 'map_Kd') {
          var fileName = tokens[1];
          var dir = name.substr(0, name.lastIndexOf('/'));

          var image = new Image();
          image.source = dir + '/' + fileName;
          image.mtl = currentMtl;
          images.push(image);
        } else {
          continue;
        }
      }

      for (var i = 0; i < images.length; i++) {
        images[i].onload = function() {
          this.loaded = true;

          obj.textures[this.mtl] = this;

          var allLoaded = true;
          for (var j = 0; j < images.length; j++) {
            allLoaded = allLoaded && !!images[j].loaded;
          }

          if (allLoaded) {
            done();
          }
        }
      }

      for (var i = 0; i < images.length; i++) {
        images[i].src = images[i].source;
      }
    }
  };

  mtlRequest.open('GET', name + '.mtl', true);
  mtlRequest.send();
}