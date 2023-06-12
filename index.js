/* ================================================================================

	database-update-send-email.
  
  Glitch example: https://glitch.com/edit/#!/notion-database-email-update
  Find the official Notion API client @ https://github.com/makenotion/notion-sdk-js/

================================================================================ */

const { Client } = require("@notionhq/client")
const dotenv = require("dotenv")

dotenv.config()
const notion = new Client({ auth: process.env.NOTION_KEY })

const databaseId = process.env.NOTION_DATABASE_ID

/**
 * Local map to store task pageId to its last status.
 * { [pageId: string]: string }
 */
const taskPageIdToStatusMap = {}

/**
 * Initialize local data store.
 * Then poll for changes every 5 seconds (5000 milliseconds).
 */
setInitialTaskPageIdToStatusMap().then(() => {
  setInterval(findAndSendEmailsForUpdatedTasks, 5000)
})

/**
 * Get and set the initial data store with tasks currently in the database.
 */
async function setInitialTaskPageIdToStatusMap() {
  const currentTasks = await getTasksFromNotionDatabase()
  // for (const { pageId, status } of currentTasks) {
  //   taskPageIdToStatusMap[pageId] = status
  // }
}

async function findAndSendEmailsForUpdatedTasks() {
  // Get the tasks currently in the database.
  console.log("\nFetching tasks from Notion DB...")
  const currentTasks = await getTasksFromNotionDatabase()
  console.log(currentTasks)
  // // Return any tasks that have had their status updated.
  // const updatedTasks = findUpdatedTasks(currentTasks)
  
  // console.log(`Found ${updatedTasks.length} updated tasks.`)

  // // For each updated task, update taskPageIdToStatusMap and send an email notification.
  // for (const task of updatedTasks) {
  //   taskPageIdToStatusMap[task.pageId] = task.status
  //   //await sendUpdateEmailWithSendgrid(task)
  // }
}

/**
 * Gets tasks from the database.
 *
 * @returns {Promise<Array<{ pageId: string, status: string, title: string }>>}
 */
async function getTasksFromNotionDatabase() {
  const pages = []
  let cursor = undefined

  while (true) {
    const { results, next_cursor } = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    })
    pages.push(...results)
    if (!next_cursor) {
      break
    }
    cursor = next_cursor
  }
  console.log(`${pages.length} pages successfully fetched.`)

  const tasks = []
  for (const page of pages) {
    const pageId = page.id

    const statusPropertyId = page.properties["Status"].id
    const statusPropertyItem = await getPropertyValue({
      pageId,
      propertyId: statusPropertyId,
    })
    const status = statusPropertyItem.status.name
      ? statusPropertyItem.status.name
      : "No Status"

    const dateFinishedPropertyId = page.properties["DateFinished"].id
    const dateFinishedPropertyItem = await getPropertyValue({
          pageId,
          propertyId: dateFinishedPropertyId,
        })
    const dateFinished = dateFinishedPropertyItem.date 

    const titlePropertyId = page.properties["Name"].id
    const titlePropertyItems = await getPropertyValue({
      pageId,
      propertyId: titlePropertyId,
    })
    const title = titlePropertyItems
      .map(propertyItem => propertyItem.title.plain_text)
      .join("")


    if(dateFinished == null){
      if(status == "Done"){
        var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
        var localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
        
        await notion.pages.update({
          page_id: pageId,
          properties: {
            "DateFinished": {
              date: {
                start: localISOTime.split('T')[0],
              },
            },
          },
        })

        tasks.push({ pageId, status, title })
      }
    }


    

    
  }

   return tasks
}

/**
//  * Compares task to most recent version of task stored in taskPageIdToStatusMap.
//  * Returns any tasks that have a different status than their last version.
//  *
//  * @param {Array<{ pageId: string, status: string, title: string }>} currentTasks
//  * @returns {Array<{ pageId: string, status: string, title: string }>}
//  */
// function findUpdatedTasks(currentTasks) {
//   return currentTasks.filter(currentTask => {
//     const previousStatus = getPreviousTaskStatus(currentTask)
//     return currentTask.status !== previousStatus
//   })
// }

// /**
//  * Finds or creates task in local data store and returns its status.
//  * @param {{ pageId: string; status: string }} task
//  * @returns {string}
//  */
// function getPreviousTaskStatus({ pageId, status }) {
//   // If this task hasn't been seen before, add to local pageId to status map.
//   if (!taskPageIdToStatusMap[pageId]) {
//     taskPageIdToStatusMap[pageId] = status
//   }
//   return taskPageIdToStatusMap[pageId]
// }

/**
 * If property is paginated, returns an array of property items.
 *
 * Otherwise, it will return a single property item.
 *
 * @param {{ pageId: string, propertyId: string }}
 * @returns {Promise<PropertyItemObject | Array<PropertyItemObject>>}
 */
async function getPropertyValue({ pageId, propertyId }) {
  const propertyItem = await notion.pages.properties.retrieve({
    page_id: pageId,
    property_id: propertyId,
  })
  if (propertyItem.object === "property_item") {
    return propertyItem
  }

  // Property is paginated.
  let nextCursor = propertyItem.next_cursor
  const results = propertyItem.results

  while (nextCursor !== null) {
    const propertyItem = await notion.pages.properties.retrieve({
      page_id: pageId,
      property_id: propertyId,
      start_cursor: nextCursor,
    })

    nextCursor = propertyItem.next_cursor
    results.push(...propertyItem.results)
  }

  return results
}

// const OPERATION_BATCH_SIZE = 10
// /***
//  *
//  * @param pagesToUpdate: [pages]
//  * @returns Promise
//  */
// async function updatePages(pagesToUpdate) {
//   const pagesToUpdateChunks = _.chunk(pagesToUpdate, OPERATION_BATCH_SIZE)
//   for (const pagesToUpdateBatch of pagesToUpdateChunks) {
//     //Update page status property
//     if (UPDATE_STATUS_IN_NOTION_DB) {
//       await Promise.all(
//         pagesToUpdateBatch.map(({ ...pr }) =>
//           //Update Notion Page status
//           notion.pages.update({
//             page_id: pr.page_id,
//             properties: {
//               [STATUS_PROPERTY_NAME]: {
//                 status: {
//                   name: pr.pr_status,
//                 },
//               },
//             },
//           })
//         )
//       )
//     }
//     //Write Comment
//     await Promise.all(
//       pagesToUpdateBatch.map(({ pageId, ...pr }) =>
//         notion.comments.create({
//           parent: {
//             page_id: pr.page_id,
//           },
//           rich_text: [
//             {
//               type: "text",
//               text: {
//                 content: "Your PR",
//                 link: {
//                   url: pr.pr_link,
//                 },
//               },
//               annotations: {
//                 bold: true,
//               },
//             },
//             {
//               type: "text",
//               text: {
//                 content: pr.comment_content,
//               },
//             },
//           ],
//         })
//       )
//     )
//   }
//   if (pagesToUpdate.length == 0) {
//     console.log("Notion Tasks are already up-to-date")
//   } else {
//     console.log(
//       "Successfully updated " + pagesToUpdate.length + " task(s) in Notion"
//     )
//   }
// }