<script setup lang="ts">
import Header from './components/Header.vue';
import Breadcrumb from './components/Breadcrumb.vue';
import Footer from './components/Footer.vue';
import ChatbotOverlay from './components/ChatbotOverlay.vue';
</script>

<template>
  <div class="flex flex-col min-h-screen w-full relative">


    <Header />
    <Breadcrumb />

    <!-- Main Content Area where child routes are injected -->
    <main class="flex-1 w-full flex flex-col">
      <router-view />
    </main>

    <Footer />
    
    <ChatbotOverlay />
  </div>
</template>
