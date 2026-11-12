import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export const releaseVersion=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
export function assertCurrentCache(source){
 const name=source.match(/^const CACHE_NAME = '([^']+)';$/m)?.[1];
 assert.equal(name,'busraj-games-v66-release-'+releaseVersion.replaceAll('.','-'));
}
export function assertReleaseAtLeast(version,minimum){
 assert.match(version,/^\d+\.\d+\.\d+$/);
 const actual=version.split('.').map(Number),floor=minimum.split('.').map(Number);
 const index=actual.findIndex((part,i)=>part!==floor[i]);
 assert.ok(index===-1||actual[index]>floor[index],`${version} must be at least ${minimum}`);
}
