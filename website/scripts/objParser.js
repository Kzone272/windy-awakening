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
      var currentGroup = '';

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
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
        } else if (tokens[0] == 'g') {
          currentGroup = tokens[1];
        } else {
          continue;
        }
      }

      obj.verts = [];
      obj.normals = [];
      obj.texCoords = [];
      obj.groups = [];

      var previousGroup = '';
      for (var i = 0; i < faces.length; i++) {
        var face = faces[i];

        if (face.g !== previousGroup) {
          if (obj.groups.length) {
            var lastGroup = obj.groups[obj.groups.length - 1];
            lastGroup.size = obj.verts.length / 3 - lastGroup.offset;
          }

          obj.groups.push({
            offset: obj.verts.length / 3,
            size: 0,
          });
        }
        previousGroup = face.g;

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
