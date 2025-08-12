/**
 * Simple test suite for ak-diagnostic
 */

const assert = require('assert');
const { Diagnostics } = require('../index.js');

console.log('Running ak-diagnostic tests...\n');

// Test 1: Constructor validation
console.log('Test 1: Constructor validation');
try {
  new Diagnostics({});
  assert.fail('Should require name option');
} catch (error) {
  assert.strictEqual(error.message, 'Diagnostics requires a "name" option');
  console.log('✓ Constructor requires name option');
}

// Test 2: Basic functionality
console.log('\nTest 2: Basic functionality');
const diag = new Diagnostics({
  name: 'TestApp',
  interval: 100
});

assert.strictEqual(diag.status().running, false, 'Should not be running initially');
console.log('✓ Initial state is not running');

diag.start();
assert.strictEqual(diag.status().running, true, 'Should be running after start()');
console.log('✓ Starts correctly');

diag.stop();
assert.strictEqual(diag.status().running, false, 'Should not be running after stop()');
console.log('✓ Stops correctly');

// Test 3: Report generation
console.log('\nTest 3: Report generation');
const diag2 = new Diagnostics({
  name: 'ReportTest',
  interval: 50
});

diag2.start();

// Let it collect some samples
setTimeout(() => {
  diag2.stop();
  const report = diag2.report();
  
  assert.strictEqual(report.name, 'ReportTest');
  console.log('✓ Report contains correct name');
  
  assert.ok(report.memory);
  assert.ok(report.memory.peak);
  assert.ok(report.memory.average);
  assert.ok(report.memory.low);
  console.log('✓ Report contains memory statistics');
  
  assert.ok(report.cpu);
  assert.ok(report.cpu.peak);
  console.log('✓ Report contains CPU statistics');
  
  assert.ok(report.clock);
  assert.ok(report.clock.duration >= 0);
  console.log('✓ Report contains timing information');
  
  assert.ok(report.analysis);
  assert.ok(report.analysis.numSamples > 0);
  console.log('✓ Report contains analysis data');
  
  assert.ok(report.summary);
  console.log('✓ Report contains summary');
  
  // Test 4: Alert functionality
  console.log('\nTest 4: Alert functionality');
  let alertTriggered = false;
  const diag3 = new Diagnostics({
    name: 'AlertTest',
    interval: 50,
    threshold: 1, // Very low threshold to trigger alert
    alert: (info) => {
      alertTriggered = true;
      assert.ok(info.memory);
      assert.ok(info.timestamp);
      assert.strictEqual(info.name, 'AlertTest');
    }
  });
  
  diag3.start();
  
  setTimeout(() => {
    diag3.stop();
    assert.ok(alertTriggered, 'Alert should have been triggered');
    console.log('✓ Alert triggers correctly');
    
    const report = diag3.report();
    assert.ok(report.analysis.numOfAlertTriggers > 0);
    console.log('✓ Alert count tracked correctly');
    
    // Test 5: Target tracking
    console.log('\nTest 5: Target tracking');
    const diag4 = new Diagnostics({
      name: 'TargetTest',
      interval: 50,
      target: 1 // Very low target
    });
    
    diag4.start();
    
    setTimeout(() => {
      diag4.stop();
      const report = diag4.report();
      
      assert.ok(report.analysis.timeOverTarget > 0);
      console.log('✓ Time over target tracked');
      
      assert.ok(report.analysis.timeOverTargetHuman);
      console.log('✓ Human-readable time format works');
      
      assert.strictEqual(
        report.analysis.timeOverTarget + report.analysis.timeUnderTarget,
        report.clock.duration
      );
      console.log('✓ Time calculations are consistent');
      
      // Test 6: Reset functionality
      console.log('\nTest 6: Reset functionality');
      const diag5 = new Diagnostics({
        name: 'ResetTest',
        interval: 50
      });
      
      diag5.start();
      setTimeout(() => {
        diag5.stop();
        const report1 = diag5.report();
        const samples1 = report1.analysis.numSamples;
        
        diag5.reset();
        assert.strictEqual(diag5.status().samplesCollected, 0);
        console.log('✓ Reset clears samples');
        
        diag5.start();
        setTimeout(() => {
          diag5.stop();
          const report2 = diag5.report();
          const samples2 = report2.analysis.numSamples;
          
          assert.ok(samples2 > 0);
          assert.ok(samples2 < samples1); // Should have fewer samples after reset
          console.log('✓ Can collect new samples after reset');
          
          // Test 7: Status method
          console.log('\nTest 7: Status method');
          const diag6 = new Diagnostics({
            name: 'StatusTest',
            interval: 100
          });
          
          const status1 = diag6.status();
          assert.strictEqual(status1.running, false);
          assert.strictEqual(status1.name, 'StatusTest');
          assert.strictEqual(status1.samplesCollected, 0);
          console.log('✓ Status shows initial state correctly');
          
          diag6.start();
          setTimeout(() => {
            const status2 = diag6.status();
            assert.strictEqual(status2.running, true);
            assert.ok(status2.samplesCollected > 0);
            assert.ok(status2.uptime > 0);
            console.log('✓ Status shows running state correctly');
            
            diag6.stop();
            
            // Test 8: System info
            console.log('\nTest 8: System info');
            const report = diag6.report();
            assert.ok(report.infos);
            assert.ok(report.infos.platform);
            assert.ok(report.infos.nodeVersion);
            assert.ok(report.infos.cpus);
            console.log('✓ System info collected correctly');
            
            // Test 9: Human-readable formats
            console.log('\nTest 9: Human-readable formats');
            assert.ok(report.memory.peak.human.includes('B')); // Should have byte unit
            assert.ok(report.cpu.peak.human.includes('%'));
            assert.ok(report.clock.human.length > 0);
            console.log('✓ Human-readable formats work correctly');
            
            // Test 10: Multiple start/stop cycles
            console.log('\nTest 10: Multiple start/stop cycles');
            const diag7 = new Diagnostics({
              name: 'CycleTest',
              interval: 50
            });
            
            diag7.start();
            setTimeout(() => {
              diag7.stop();
              const report1 = diag7.report();
              const samples1 = report1.analysis.numSamples;
              
              // Start again without reset
              diag7.start();
              setTimeout(() => {
                diag7.stop();
                const report2 = diag7.report();
                const samples2 = report2.analysis.numSamples;
                
                // Should have more samples since we didn't reset
                assert.ok(samples2 > samples1);
                console.log('✓ Multiple cycles accumulate data correctly');
                
                console.log('\n' + '='.repeat(50));
                console.log('All tests passed! ✅');
                console.log('='.repeat(50));
                
                process.exit(0);
              }, 200);
            }, 200);
          }, 200);
        }, 200);
      }, 200);
    }, 200);
  }, 200);
}, 200);