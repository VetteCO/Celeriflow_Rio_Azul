export type Position=[number,number];
export type OperationFeature={id:string;code:string;family:string;type:"Point"|"LineString"|"Polygon"|"MultiPolygon";parts:Position[][]};
export function geographicParts(type:string,coordinates:unknown):Position[][]|null{
 const point=(p:unknown):p is Position=>Array.isArray(p)&&p.length>=2&&typeof p[0]==="number"&&typeof p[1]==="number"&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const line=(p:unknown):p is Position[]=>Array.isArray(p)&&p.length>=2&&p.every(point);
 const ring=(p:unknown):p is Position[]=>line(p)&&p.length>=4&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1];
 if(type==="Point")return point(coordinates)?[[coordinates]]:null;
 if(type==="LineString")return line(coordinates)?[coordinates]:null;
 if(type==="Polygon")return Array.isArray(coordinates)&&coordinates.length>0&&coordinates.every(ring)?coordinates:null;
 if(type==="MultiPolygon"&&Array.isArray(coordinates)&&coordinates.length>0&&coordinates.every(p=>Array.isArray(p)&&p.length>0&&p.every(ring)))return coordinates.flat() as Position[][];
 return null;
}
