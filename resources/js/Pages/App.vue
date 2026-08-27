<template>
    <component
        :is="currentPageComponent"
        :current-page="currentPage"
        @navigate="navigateTo"
    />
</template>

<script setup>
import { ref, computed } from 'vue';
import Dashboard  from './Dashboard.vue';
import Assessment from './Assessment.vue';
import History    from './History.vue';
import Athlete    from './Athlete.vue';
import Settings   from './Settings.vue';

const currentPage = ref('dashboard');

const pageMap = {
    dashboard:  Dashboard,
    assessment: Assessment,
    history:    History,
    athlete:    Athlete,
    settings:   Settings,
};

const currentPageComponent = computed(() => pageMap[currentPage.value] ?? Dashboard);

function navigateTo(page) {
    if (pageMap[page]) currentPage.value = page;
}
</script>
