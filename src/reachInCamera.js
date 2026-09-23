import { Vector3 } from 'three';

export function fitReachInCamera({ width, height, roomDepth, aspect, fov = 32 }) {
  const target = new Vector3(0, height / 2, 0);
  const direction = new Vector3(0.16, 0.07, 1).normalize();
  const right = new Vector3(direction.z, 0, -direction.x).normalize();
  const up = new Vector3().crossVectors(direction, right);
  const tanV = Math.tan(fov * Math.PI / 360);
  const tanH = tanV * Math.max(0.1, aspect);
  let distance = 0;
  // Fit the closet and room outline with a margin on all four screen edges.
  for (const x of [-width / 2, width / 2]) for (const y of [0, height + 8]) for (const z of [-7.35, roomDepth - 7]) {
    const point = new Vector3(x, y, z).sub(target);
    distance = Math.max(distance,
      point.dot(direction) + Math.abs(point.dot(right)) / tanH,
      point.dot(direction) + Math.abs(point.dot(up)) / tanV);
  }
  distance *= 1.12;
  return { position: target.clone().addScaledVector(direction, distance).toArray(), target: target.toArray(), distance, fov };
}
