// import { boss, JOB_PROCESS_DOCUMENT, startBoss } from '../src/queue.ts'

// async function test() {
//   await startBoss()
//   const jobId = await boss.send(JOB_PROCESS_DOCUMENT, { hello: 'world' })
//   console.log('Job published:', jobId)
// }

// test()


// tests/test-boss.ts
import { boss, startBoss, JOB_PROCESS_DOCUMENT } from '../src/queue.ts'

async function main() {
    await startBoss()

    // register worker in same process
    await boss.work(JOB_PROCESS_DOCUMENT, async (job: any) => {
        console.log(`received job ${job.id} with data ${JSON.stringify(job.data)}`)
    })

    const jobId = await boss.send(JOB_PROCESS_DOCUMENT, { hello: 'same-process' })
    console.log('Published job:', jobId)
}

main()
