<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { NButton, NRadioButton, NRadioGroup, NSelect } from 'naive-ui';
import { coursesApi } from '@/api/courses';
import { useAuthStore } from '@/stores/auth';
import { PERIODS, WEEKDAYS } from '@/courseKind';

/**
 * @import { CourseFilters, SessionUser } from '@selcos/shared'
 * @import { CourseQuery } from '@/api/courses'
 */

/** 查詢條件（舊系統 selcos_main.php 左側查詢區） */
const emit = defineEmits({ search: (/** @type {CourseQuery} */ _query) => true });

const auth = useAuthStore();
const filters = ref(/** @type {CourseFilters | null} */ (null));
const loading = ref(false);

const mode = ref(/** @type {'dept' | 'time'} */ ('dept'));
const typeNo = ref(/** @type {string | null} */ (null));
const deptNo = ref(/** @type {string | null} */ (null));
const year = ref(/** @type {string | null} */ (null));
const weekday = ref('1');
const period = ref('01');

const typeOptions = computed(
  () => filters.value?.types.map((t) => ({ label: t.typeName, value: t.typeNo })) ?? [],
);
const deptOptions = computed(
  () =>
    filters.value?.depts
      .filter((d) => d.typeNo === typeNo.value)
      .map((d) => ({ label: d.deptName, value: d.deptNo })) ?? [],
);
const yearOptions = computed(() => {
  const dept = filters.value?.depts.find((d) => d.deptNo === deptNo.value);
  return Array.from({ length: dept?.gradYear ?? 0 }, (_, i) => ({
    label: `${i + 1}年級`,
    value: String(i + 1),
  }));
});
const weekdayOptions = WEEKDAYS.map((label, i) => ({ label, value: String(i + 1) }));
const periodOptions = PERIODS.map((p) => ({ label: `第${Number(p)}節`, value: p }));

// 換學制、系所時，選項不在清單內就改選第一個（同舊系統）
watch(typeNo, () => {
  if (!deptOptions.value.some((o) => o.value === deptNo.value)) {
    deptNo.value = deptOptions.value[0]?.value ?? null;
  }
});
watch(deptNo, () => {
  if (!yearOptions.value.some((o) => o.value === year.value)) {
    year.value = yearOptions.value[0]?.value ?? null;
  }
});

const canSearch = computed(() =>
  mode.value === 'time' ? true : Boolean(deptNo.value && year.value),
);

function search() {
  if (!canSearch.value) return;
  emit(
    'search',
    mode.value === 'dept'
      ? {
          mode: 'dept',
          deptNo: /** @type {string} */ (deptNo.value),
          year: /** @type {string} */ (year.value),
        }
      : { mode: 'time', weekday: weekday.value, period: period.value },
  );
}

onMounted(async () => {
  loading.value = true;
  try {
    filters.value = await coursesApi.filters();
    // 預設帶入自己的學制、系所、選課年級，並自動查詢一次
    const user = auth.me?.user;
    typeNo.value = user?.typeNo ?? typeOptions.value[0]?.value ?? null;
    deptNo.value = deptOptions.value.some((o) => o.value === user?.deptNo)
      ? /** @type {SessionUser} */ (user).deptNo
      : (deptOptions.value[0]?.value ?? null);
    const preferredYear = String(user?.currentDegree ?? user?.degree ?? '');
    year.value = yearOptions.value.some((o) => o.value === preferredYear)
      ? preferredYear
      : (yearOptions.value[0]?.value ?? null);
    search();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="grid gap-2">
    <NRadioGroup v-model:value="mode" size="small" class="w-full">
      <NRadioButton value="dept" class="w-1/2 text-center">依系所</NRadioButton>
      <NRadioButton value="time" class="w-1/2 text-center">依節次</NRadioButton>
    </NRadioGroup>

    <template v-if="mode === 'dept'">
      <NSelect v-model:value="typeNo" size="small" :options="typeOptions" :loading="loading" />
      <NSelect v-model:value="deptNo" size="small" :options="deptOptions" filterable />
      <NSelect v-model:value="year" size="small" :options="yearOptions" />
    </template>
    <template v-else>
      <NSelect v-model:value="weekday" size="small" :options="weekdayOptions" />
      <NSelect v-model:value="period" size="small" :options="periodOptions" />
    </template>

    <NButton type="primary" size="small" block round :disabled="!canSearch" @click="search">
      查詢
    </NButton>
  </div>
</template>
