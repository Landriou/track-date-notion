
const { Client } = require("@notionhq/client")
const dotenv = require("dotenv")

dotenv.config()
const notion = new Client({ auth: process.env.NOTION_KEY })

const databaseId = process.env.NOTION_DATABASE_ID


startProcess().then(() => {
  setInterval(RepeatProcess, 10000)
})

/**
 * Get and set the initial data store with tasks currently in the database.
 */
async function startProcess() {
  const currentTasks = await getTasksAndUpdateFromNotionDatabase()
}

async function RepeatProcess() {
  // Get the tasks currently in the database.
  console.log("\nFetching tasks from Notion DB...")
  const currentTasks = await getTasksAndUpdateFromNotionDatabase()
  console.log(currentTasks)
}

/**
 * Gets tasks from the database and update when date finished is null and status is done
 *
 */
async function getTasksAndUpdateFromNotionDatabase() {
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
