#include <cbor.h>
#include <stdio.h>

int main() {
  cbor_item_t *map = cbor_new_definite_map(2);

  cbor_map_add(map, (struct cbor_pair){.key = cbor_build_string("ok"),
                                       .value = cbor_build_bool(true)});

  cbor_map_add(map, (struct cbor_pair){.key = cbor_build_string("value"),
                                       .value = cbor_build_uint32(42)});

  unsigned char *buffer;
  size_t buffer_size, length;

  buffer_size = cbor_serialize_alloc(map, &buffer, &length);

  FILE *f = fopen("out.cbor", "wb");
  fwrite(buffer, 1, length, f);
  fclose(f);

  free(buffer);
  cbor_decref(&map);
  return 0;
}
