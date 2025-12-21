/**
 * MODULE VERIFICATION SCRIPT
 *
 * Logs module loading status and provides debugging info
 * Run this in console or add to page load
 */

(function() {
    'use strict';

    console.log('=' .repeat(60));
    console.log('MODULE VERIFICATION');
    console.log('='.repeat(60));

    // Check all required modules
    const modules = {
        'Navigation': window.Navigation,
        'ModuleLearning': window.ModuleLearning,
        'ModuleModal': window.ModuleModal,
        'PlacementModule': window.PlacementModule,
        'ResourceTabs': window.ResourceTabs,
        'State': window.State,
        'Storage': window.Storage,
        'DataLoader': window.DataLoader,
        'UI': window.UI,
        'QuizModule': window.QuizModule,
        'LEARNING_SYSTEM': window.LEARNING_SYSTEM,
        'DATA': window.DATA
    };

    let allLoaded = true;

    Object.keys(modules).forEach(name => {
        const status = modules[name] ? '✅ LOADED' : '❌ NOT LOADED';
        console.log(`${status} - ${name}:`, typeof modules[name]);
        if (!modules[name]) allLoaded = false;
    });

    console.log('='.repeat(60));

    if (allLoaded) {
        console.log('✅ ALL MODULES LOADED SUCCESSFULLY');

        // Check if ModuleLearning has the correct methods
        if (window.ModuleLearning) {
            console.log('\n🔍 ModuleLearning Methods:');
            const methods = ['start', 'loadStep', 'nextStep', 'prevStep', 'renderPostTest', 'updateNextButtonState'];
            methods.forEach(method => {
                const exists = typeof window.ModuleLearning[method] === 'function';
                console.log(`  ${exists ? '✅' : '❌'} ${method}`);
            });

            // Check step list
            if (window.ModuleLearning.steps) {
                console.log('\n🔵 Current stepList:', window.ModuleLearning.steps);
                console.log('🔵 Current stepNames:', window.ModuleLearning.stepNames);
            }
        }

        // Check post-test data
        if (window.LEARNING_SYSTEM && window.LEARNING_SYSTEM.modules) {
            console.log('\n📝 Post-Test Data Check:');
            window.LEARNING_SYSTEM.modules.slice(0, 2).forEach(module => {
                const hasPostTest = !!(module.postTest && module.postTest.questions && module.postTest.questions.length > 0);
                console.log(`  ${module.id}: ${hasPostTest ? '✅' : '❌'} ${module.postTest?.questions?.length || 0} questions`);
            });
        }
    } else {
        console.error('❌ SOME MODULES FAILED TO LOAD');
        console.error('This will cause placeholder warnings and broken functionality');
    }

    console.log('='.repeat(60));

    // Expose verification function for manual checking
    window.verifyModules = function() {
        console.log('\n🔄 Re-checking modules...\n');
        Object.keys(modules).forEach(name => {
            modules[name] = window[name];
            const status = modules[name] ? '✅' : '❌';
            console.log(`${status} ${name}`);
        });
    };

    window.checkPostTestState = function(moduleId) {
        moduleId = moduleId || 'module-1';
        console.log(`\n📊 Post-Test State for ${moduleId}:`);
        console.log('State.moduleMastery.modules[' + moduleId + '].postTest:',
            window.State?.moduleMastery?.modules?.[moduleId]?.postTest);
    };

    console.log('\n💡 Helper functions available:');
    console.log('  - verifyModules() - Check module loading status');
    console.log('  - checkPostTestState(moduleId) - Check post-test completion state');
})();
