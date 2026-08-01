import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDataStore = defineStore('data', () => {
  const PRODUCTS = ref<any[]>([]);

  const SERVICES = ref<any[]>([]);

  return {
    PRODUCTS,
    SERVICES
  };
});
