<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-lg w-[90vw] max-w-md max-h-[70vh] flex flex-col">
        <div class="p-4 border-b">
          <h3 class="text-lg font-medium">Переместить вместе?</h3>
          <p class="text-sm text-gray-500 mt-1">
            Здесь числится ещё {{ objects.length }} объект(ов).
          </p>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div v-for="obj in objects" :key="obj.id" class="flex items-center gap-3 py-2 border-b last:border-0">
            <input type="checkbox" v-model="selectedIds" :value="obj.id" class="w-5 h-5" />
            <div>
              <div class="text-sm font-medium">{{ obj.buhName || '—' }}</div>
              <div class="text-xs text-gray-500">{{ obj.invNumber || '—' }}</div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 p-3 border-t">
          <button
            @click="$emit('skip')"
            class="flex-1 py-3 px-4 bg-white text-gray-700 border border-gray-300 rounded-md text-base font-medium active:bg-gray-50"
          >
            Пропустить
          </button>
          <button
            @click="$emit('confirm', selectedIds)"
            :disabled="!hasSelection"
            class="flex-1 py-3 px-4 bg-blue-500 text-white border border-blue-500 rounded-md text-base font-medium active:bg-blue-600 disabled:opacity-50"
          >
            Переместить выбранные
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed } from 'vue'

defineProps({
  isOpen: Boolean,
  objects: { type: Array, default: () => [] }
})

defineEmits(['confirm', 'skip'])

const selectedIds = ref([])
const hasSelection = computed(() => selectedIds.value.length > 0)
</script>