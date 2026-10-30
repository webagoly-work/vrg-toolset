// =============================================================================
// sd.ino — the device's own microSD: mount, directory listing, text read.
// This is the part that works with NO PC: the whole reason for the device.
//
// Expected SD layout (see ../../sd-template/):
//   /reference/...      offline Súgó + command crib sheets (.txt)
//   /reference/bios-boot-keys.txt   the Rescue page reads this
//   /manifest/manifest.json         what the deployment stick should hold
// =============================================================================

void sdInit() {
  gSdOk = SD.begin(SD_CS);
  if (!gSdOk) {
    // retry once at a lower clock; cheap cards + shared bus can be fussy
    gSdOk = SD.begin(SD_CS, SPI, 10000000);
  }
}

int sdCardGB() { return gSdOk ? (int)(SD.cardSize() / 1073741824ULL) : 0; }
int sdFreeGB() {
  if (!gSdOk) return 0;
  uint64_t total = SD.totalBytes(), used = SD.usedBytes();
  return (int)((total - used) / 1073741824ULL);
}

// fill gList[] from an SD directory
void sdList(const char* path) {
  gListN = 0;
  if (!gSdOk) return;
  File dir = SD.open(path);
  if (!dir || !dir.isDirectory()) { if (dir) dir.close(); return; }
  File f = dir.openNextFile();
  while (f && gListN < MAX_LIST) {
    const char* nm = f.name();
    // SD .name() may be a full path on some cores; keep the last segment
    const char* base = nm; for (const char* p = nm; *p; p++) if (*p == '/') base = p + 1;
    strncpy(gList[gListN].name, base, sizeof(gList[0].name) - 1);
    gList[gListN].name[sizeof(gList[0].name) - 1] = 0;
    gList[gListN].isDir = f.isDirectory() ? 1 : 0;
    gList[gListN].sizeKB = f.isDirectory() ? 0 : (uint32_t)(f.size() / 1024);
    gListN++;
    f.close();
    f = dir.openNextFile();
  }
  dir.close();
  // directories first, then name order (simple insertion sort, small N)
  for (int i = 1; i < gListN; i++) {
    Entry key = gList[i]; int j = i - 1;
    while (j >= 0 && ((gList[j].isDir < key.isDir) || (gList[j].isDir == key.isDir && strcmp(gList[j].name, key.name) > 0))) { gList[j + 1] = gList[j]; j--; }
    gList[j + 1] = key;
  }
}

bool sdReadText(const char* path, char* out, size_t cap) {
  out[0] = 0;
  if (!gSdOk) return false;
  File f = SD.open(path);
  if (!f) return false;
  size_t n = f.read((uint8_t*)out, cap - 1);
  out[n] = 0;
  f.close();
  return true;
}

// join the current gPath with a child segment, in place
void pathPush(const char* seg) {
  size_t L = strlen(gPath);
  if (L && gPath[L - 1] != '/') { if (L < sizeof(gPath) - 1) { gPath[L++] = '/'; gPath[L] = 0; } }
  strncat(gPath, seg, sizeof(gPath) - strlen(gPath) - 1);
}
void pathPop() {
  size_t L = strlen(gPath);
  if (L <= 1) { strcpy(gPath, "/"); return; }
  if (gPath[L - 1] == '/') gPath[--L] = 0;
  while (L > 1 && gPath[L - 1] != '/') gPath[--L] = 0;
  if (L > 1 && gPath[L - 1] == '/') gPath[L - 1] = 0;
  if (!gPath[0]) strcpy(gPath, "/");
}
