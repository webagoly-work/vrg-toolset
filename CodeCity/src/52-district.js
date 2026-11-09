// 52-district.js — K2-04: what makes the districts visible beyond their streets (02-grow.js lays them out, 51-grammar
// turns each building to its district's style). Here: the Vár — the Domoszló castle at the head of the first track
// (CITY-D55 A: the founding story, named; other jobs later), the villas' garden pools (lit, they are the suburb's
// signature at night), and each district's name over its middle. All of it belongs to the grown plan's group.

function districtMeshes(gw, PL) {
  const g = new THREE.Group(), stone = new THREE.MeshLambertMaterial({ color: 0x6b7178 }), dark = new THREE.MeshLambertMaterial({ color: 0x4a5057 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  // ---- the castle: a curtain wall with four round towers and a gate towards the track, a keep with battlements, a flag
  {
    const [cx, cz0] = gw.castle, cz = cz0 - 6, W = 18, D = 14, H = 3.6, T = 0.9;
    for (const [w, d, x, z] of [[W, T, 0, -D / 2], [T, D, -W / 2, 0], [T, D, W / 2, 0], [(W - 3.4) / 2, T, -(W + 3.4) / 4, D / 2], [(W - 3.4) / 2, T, (W + 3.4) / 4, D / 2]]) {
      add(new THREE.BoxGeometry(w, H, d).translate(0, H / 2, 0), stone, cx + x, PL, cz + z);
      // merlons along the wall top
      const n = Math.max(2, Math.floor(Math.max(w, d) / 1.4));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        add(new THREE.BoxGeometry(0.6, 0.6, 0.6).translate(0, 0.3, 0), stone, cx + x + (w > d ? t * w : 0), PL + H, cz + z + (w > d ? 0 : t * d));
      }
    }
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
      add(new THREE.CylinderGeometry(1.35, 1.5, 5.6, 12).translate(0, 2.8, 0), stone, cx + x, PL, cz + z);
      add(new THREE.ConeGeometry(1.7, 2.2, 12).translate(0, 1.1, 0), dark, cx + x, PL + 5.6, cz + z);
    }
    add(new THREE.BoxGeometry(3.4, 4.6, 1.3).translate(0, 2.3, 0), stone, cx - 2.6, PL, cz + D / 2);   // the gatehouse
    add(new THREE.BoxGeometry(3.4, 4.6, 1.3).translate(0, 2.3, 0), stone, cx + 2.6, PL, cz + D / 2);
    const kx = cx, kz = cz - 2.5;
    add(new THREE.BoxGeometry(6.5, 11, 6.5).translate(0, 5.5, 0), stone, kx, PL, kz);                    // the keep
    for (let k = 0; k < 4; k++) for (let m = 0; m < 4; m++) {
      if (k > 0 && k < 3 && m > 0 && m < 3) continue;
      add(new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(0, 0.4, 0), stone, kx - 2.85 + k * 1.9, PL + 11, kz - 2.85 + m * 1.9);
    }
    // the keep's windows: a few warm slits (Lambert walls do not carry the window shader)
    const slit = new THREE.MeshBasicMaterial({ color: 0xffc977 });
    for (const [y, x] of [[4, -1.2], [4, 1.2], [7.5, 0], [9.5, -1.4], [9.5, 1.4]]) add(new THREE.BoxGeometry(0.35, 0.9, 0.05), slit, kx + x, PL + y, kz + 3.27);
    add(new THREE.CylinderGeometry(0.07, 0.07, 4, 6).translate(0, 2, 0), dark, kx, PL + 11, kz);          // the flag
    const flag = add(new THREE.PlaneGeometry(2.2, 1.3).translate(1.1, 0, 0), new THREE.MeshLambertMaterial({ color: 0xb8323a, side: THREE.DoubleSide }), kx + 0.05, PL + 14.3, kz);
    flag.name = 'flag';
    g.add(districtLabel('Domoszló', '#e9d9b0', cx, PL + 19, cz, 0.9));
  }
  // ---- the villas' pools: lit water in the gardens
  if (gw.pools && gw.pools.length) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    const rims = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.12, 1).translate(0, 0.06, 0), new THREE.MeshLambertMaterial({ color: 0x9aa3a8 }), gw.pools.length);
    const water = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3fc9e8 }), gw.pools.length);
    gw.pools.forEach((p, k) => {
      q.setFromAxisAngle(Y, -p.a);
      rims.setMatrixAt(k, m4.compose(new THREE.Vector3(p.x, PL, p.z), q, new THREE.Vector3(p.w + 0.5, 1, p.d + 0.5)));
      water.setMatrixAt(k, m4.compose(new THREE.Vector3(p.x, PL + 0.14, p.z), q, new THREE.Vector3(p.w, 1, p.d)));
    });
    g.add(rims, water);
  }
  // ---- the districts' names, over their middles
  for (const d of gw.districts || []) g.add(districtLabel(d.name, '#b9cfdc', d.x, PL + 26, d.z, 0.6 + Math.min(0.6, d.n / 400)));
  g.traverse(o => { o.raycast = () => {}; });
  return g;
}

function districtLabel(text, color, x, y, z, k = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: landLabel(text, color), transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  sp.scale.set(48 * k, 9 * k, 1);
  sp.position.set(x, y, z);
  sp.name = 'district-label';
  return sp;
}
