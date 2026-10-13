<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'

import { isUserBusy } from '@/composables/useAppBusy'
import { useSwUpdate } from '@/composables/useSwUpdate'

/**
 * Применение PWA-обновления.
 *
 * Как только новый service worker готов (updatePending) И пользователь
 * ничем не занят (isUserBusy === false) — шлём ему SKIP_WAITING[1], он
 * активируется, приходит controllerchange, страница перезагружается.
 * Если пользователь занят, watcher просто ничего не делает и сработает
 * позже, когда счётчик занятости обнулится.
 *
 * [1] Раньше здесь висел мёртвый слушатель SW_UPDATED с setTimeout(reload):
 * событие слал старый public/sw.js, который никто не регистрировал, так что
 * перезагрузка не приходила никогда. Плюс слепая перезагрузка через секунду
 * после события всё равно потеряла бы несохранённый ввод.
 */
const { updatePending, applyUpdate } = useSwUpdate()

/** Ключ офлайн-режима («режим полёта»), см. views/Home/components/FlightModeToggle.vue */
const FLIGHT_MODE_KEY = 'u40ta_flight_mode'

/**
 * Можно ли сейчас перезагружать страницу.
 *
 * Специфика u40ta, которой нет в ph: у проекта свой офлайн-режим на Dexie
 * (services/offline-cache.service.js, offline-sync.service.js). Если он
 * включён (режим полёта) или сети нет вообще, перезагрузка попадёт в
 * момент офлайн-синхронизации и потеряет данные — поэтому обновление
 * откладываем до возвращения в онлайн. В отличие от занятости формы,
 * это состояние само по себе не изменит updatePending, поэтому ниже
 * слушаем события online и flight-mode-changed.
 */
function canApplyNow() {
  // Значение пишется через JSON.stringify, то есть строка 'true'/'false'
  if (localStorage.getItem(FLIGHT_MODE_KEY) === 'true') return false
  if (!navigator.onLine) return false
  return true
}

/** Применить обновление, если оно есть и применять его сейчас безопасно. */
function maybeApplyUpdate() {
  if (!updatePending.value) return
  if (isUserBusy.value) return
  if (!canApplyNow()) return
  applyUpdate()
}

/**
 * Следим именно за парой: обновление готово + пользователь свободен.
 * immediate — на случай, если SW уже ждал активации к моменту монтирования.
 */
watch([updatePending, isUserBusy], maybeApplyUpdate, { immediate: true })

/**
 * Повод применить отложенное обновление, когда помешавшие условия ушли:
 * сеть вернулась или режим полёта выключили (событие шлёт FlightModeToggle).
 */
onMounted(() => {
  window.addEventListener('online', maybeApplyUpdate)
  window.addEventListener('flight-mode-changed', maybeApplyUpdate)
})

onUnmounted(() => {
  window.removeEventListener('online', maybeApplyUpdate)
  window.removeEventListener('flight-mode-changed', maybeApplyUpdate)
})
</script>
