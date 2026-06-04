<script setup lang="ts">
const quickStats = [
  { label: "Ca lam hom nay", value: "01" },
  { label: "Lan cham cong", value: "02" },
  { label: "Trang thai", value: "Dang lam viec" },
];
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">Tong quan nhan vien</h2>
      <p class="mt-1 text-sm text-slate-500">
        Theo doi thong tin cham cong va thao tac nhanh ngay tai day.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="item in quickStats"
        :key="item.label"
        class="rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</p>
        <p class="mt-2 text-xl font-semibold text-slate-900">{{ item.value }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <p class="text-sm text-slate-600">
        Ban co the mo rong them cac module nhu:
        danh sach lich lam, thong tin ca nhan, thong bao noi bo...
      </p>
    </div>
  </div>
</template>
