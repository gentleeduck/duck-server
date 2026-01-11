#include <cbor.h>
#include <stdio.h>
#include <stdlib.h>

int main() {
  FILE *f = fopen("response.cbor", "rb");
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  rewind(f);

  unsigned char *data = malloc(size);
  fread(data, 1, size, f);
  fclose(f);

  struct cbor_load_result result;
  cbor_item_t *item = cbor_load(data, size, &result);
  free(data);

  if (!item || result.error.code != CBOR_ERR_NONE) {
    puts("CBOR decode failed");
    return 1;
  }

  if (cbor_isa_map(item)) {
    size_t count = cbor_map_size(item);
    struct cbor_pair *pairs = cbor_map_handle(item);

    for (size_t i = 0; i < count; i++) {
      printf("key: %s\n", cbor_string_handle(pairs[i].key));
    }
  }

  cbor_decref(&item);
  return 0;
}
